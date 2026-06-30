// app/api/order/route.ts
import { supabase as supabaseClient } from '@/app/lib/supabase';
import { NextResponse } from 'next/server';


// 🔒 [방어선 1] 서버 메모리에 IP별 최근 요청 시간들을 기록할 저장소
// 서버가 켜져 있는 동안 전역적으로 유지됩니다.
const ipCache = new Map<string, number[]>();


export async function POST(request: Request) {
  // 1. 요청한 사용자의 실제 IP 주소 추출 (Vercel 헤더 대응)
  const ip = request.headers.get('x-forwarded-for') || 'anonymous-user';
  const now = Date.now();
  
  // 2. 해당 IP의 과거 기록 배열 가져오기
  if (!ipCache.has(ip)) {
    ipCache.set(ip, []);
  }
  const timestamps = ipCache.get(ip)!;
  
  // 3. 1분(60초)이 지난 과거 기록은 배열에서 청소 (메모리 관리 및 누적 방지)
  const oneMinuteAgo = now - 60 * 1000;
  const recentRequests = timestamps.filter(time => time > oneMinuteAgo);
  
  // 4. 🔥 [핵심 차단] 1분 이내 요청이 5번을 초과하면 즉각 실행 차단!
  // Supabase를 찌르기도 전에 여기서 429 에러로 내쫓습니다.
  if (recentRequests.length >= 5) {
    return NextResponse.json(
      { error: '단시간에 너무 많은 요청이 발생했습니다. 1분 후 다시 시도해 주세요.' }, 
      { status: 429 }
    );
  }
  
  // 5. 제한을 통과했으므로 현재 요청 시간을 기록에 추가
  recentRequests.push(now);
  ipCache.set(ip, recentRequests);


  try {
    
    
    const body = await request.json();
    //console.log("🔥 서버에 수신된 데이터 전체 확인:", body); // 터미널 콘솔에 찍힙니다.

    const { customerName, contact, boardColor, selectedSize, previewImageUrl, orderType } = body;
    
    // 7. [방어선 2] previewUrl이 정상적인지 2차 검증 (null.toString 에러 방지)
    if (!previewImageUrl || previewImageUrl === 'null') {
      return NextResponse.json({ error: '이미지 주소가 비어있거나 올바르지 않습니다.' }, { status: 400 });
    }
    
    // 안전한 난수 기반 파일명 지정
    const randomId = String(Math.floor(Math.random() * 1000000));
    const fileName = `order_${Date.now()}_${randomId}.png`;


    // const { customerName, contact, boardColor, selectedSize, previewUrl, orderType } = await request.json();

    const response = await fetch(previewImageUrl);
    const blob = await response.blob();
    // const fileName = `order_${Date.now()}_${Math.random().toString(36).substring(2, 11)}.png`;
    // .toString(36) 대신 안전한 날짜 기반 랜덤 문자열 조합으로 전면 교체
    // const randomId = String(Math.floor(Math.random() * 1000000));
    // const fileName = `order_${Date.now()}_${randomId}.png`;
    
    const { error: storageError } = await supabaseClient.storage
      .from('engraving-orders')
      .upload(fileName, blob, { contentType: 'image/png' });

    if (storageError) return NextResponse.json({ error: storageError.message }, { status: 500 });

    const { data: { publicUrl } } = supabaseClient.storage
      .from('engraving-orders')
      .getPublicUrl(fileName);

    const { error: dbError } = await supabaseClient
      .from('orders')
      .insert([{
        customer_name: customerName,
        contact,
        board_color: boardColor,
        spec_size: selectedSize,
        preview_image_url: publicUrl,
        order_type: orderType
      }]);

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

    return NextResponse.json({ success: true });
    
  } catch (error: unknown) { // 🔥 기존 'any'를 'unknown'으로 변경합니다.
    console.error('API 내부 에러 발생:', error);
    
    // 에러 객체가 표준 Error 인스턴스인지 확인하여 안전하게 메시지 추출
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ error: '알 수 없는 내부 서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
// app/api/order/route.ts
import { supabase as supabaseClient } from '@/app/lib/supabase';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("🔥 서버에 수신된 데이터 전체 확인:", body); // 터미널 콘솔에 찍힙니다.

    const { customerName, contact, boardColor, selectedSize, previewUrl, orderType } = body;
    
    // 안전한 난수 기반 파일명 지정
    const randomId = String(Math.floor(Math.random() * 1000000));
    const fileName = `order_${Date.now()}_${randomId}.png`;


    // const { customerName, contact, boardColor, selectedSize, previewUrl, orderType } = await request.json();

    const response = await fetch(previewUrl);
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
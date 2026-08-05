// app/api/design-order/route.ts

import { supabase as supabaseClient } from '@/app/lib/supabase';
import { NextResponse } from 'next/server';

// Node.js 런타임에서 파일 업로드를 처리합니다.
export const runtime = 'nodejs';

// 서버가 실행 중인 동안 IP별 요청 시간을 저장합니다.
// 서버리스 환경에서는 인스턴스마다 별도로 관리되므로
// 완전한 보안 장치라기보다는 1차 방어선으로 사용합니다.
const ipCache = new Map<string, number[]>();

const MAX_REQUESTS_PER_MINUTE = 5;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

const ALLOWED_SIZES = [
  '1x1',
  '1x3',
  '1x4',
  '2x3',
  '3x3',
] as const;

const ALLOWED_COLORS = [
  'white',
  'black',
  'gray',
  'navy',
  'ivory',
] as const;

const ALLOWED_ORDER_TYPES = [
  '주문전',
  '주문완료',
] as const;

function getFormString(
  formData: FormData,
  key: string,
): string {
  const value = formData.get(key);

  return typeof value === 'string'
    ? value.trim()
    : '';
}

function createSafeFileName(
  size: string,
  color: string,
): string {
  const randomId = crypto.randomUUID();

  return [
    'design',
    Date.now(),
    randomId,
    size,
    color,
  ].join('_') + '.png';
}

export async function POST(request: Request) {
  /*
   * 1. 간단한 IP 요청 제한
   */
  const forwardedFor =
    request.headers.get('x-forwarded-for');

  const ip =
    forwardedFor?.split(',')[0]?.trim() ||
    'anonymous-user';

  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;

  const previousRequests =
    ipCache.get(ip) ?? [];

  const recentRequests =
    previousRequests.filter(
      (timestamp) => timestamp > oneMinuteAgo,
    );

  if (
    recentRequests.length >=
    MAX_REQUESTS_PER_MINUTE
  ) {
    return NextResponse.json(
      {
        error:
          '단시간에 너무 많은 요청이 발생했습니다. 1분 후 다시 시도해 주세요.',
      },
      {
        status: 429,
      },
    );
  }

  recentRequests.push(now);
  ipCache.set(ip, recentRequests);

  let uploadedFilePath: string | null = null;

  try {
    /*
     * 2. multipart/form-data 읽기
     */
    const formData = await request.formData();

    const imageValue =
      formData.get('previewImage');

    const customerName =
      getFormString(formData, 'customerName');

    const contact =
      getFormString(formData, 'contact');

    const color =
      getFormString(formData, 'color');

    const size =
      getFormString(formData, 'size');

    const orderType =
      getFormString(formData, 'orderType');

    const eventCode =
      getFormString(formData, 'eventCode');

    const productName =
      getFormString(formData, 'productName');

    const requestMessage =
      getFormString(formData, 'request');

    /*
     * 3. 이미지 검사
     */
    if (!(imageValue instanceof File)) {
      return NextResponse.json(
        {
          error:
            '시안 이미지가 첨부되지 않았습니다.',
        },
        {
          status: 400,
        },
      );
    }

    if (
      imageValue.type !== 'image/png'
    ) {
      return NextResponse.json(
        {
          error:
            '시안 이미지는 PNG 형식이어야 합니다.',
        },
        {
          status: 400,
        },
      );
    }

    if (
      imageValue.size <= 0 ||
      imageValue.size > MAX_IMAGE_SIZE
    ) {
      return NextResponse.json(
        {
          error:
            '시안 이미지의 용량은 10MB 이하여야 합니다.',
        },
        {
          status: 400,
        },
      );
    }

    /*
     * 4. 주문자 정보 검사
     */
    if (!customerName) {
      return NextResponse.json(
        {
          error:
            '주문자 이름을 입력해 주세요.',
        },
        {
          status: 400,
        },
      );
    }

    if (customerName.length > 15) {
      return NextResponse.json(
        {
          error:
            '주문자 이름은 최대 15자입니다.',
        },
        {
          status: 400,
        },
      );
    }

    const isValidContact =
      /^010\d{8}$/.test(contact) ||
      /^050\d{9}$/.test(contact);

    if (!isValidContact) {
      return NextResponse.json(
        {
          error:
            '010 또는 050으로 시작하는 올바른 연락처를 입력해 주세요.',
        },
        {
          status: 400,
        },
      );
    }

    if (
      !ALLOWED_COLORS.includes(
        color as (typeof ALLOWED_COLORS)[number],
      )
    ) {
      return NextResponse.json(
        {
          error:
            '올바르지 않은 키캡 색상입니다.',
        },
        {
          status: 400,
        },
      );
    }

    if (
      !ALLOWED_SIZES.includes(
        size as (typeof ALLOWED_SIZES)[number],
      )
    ) {
      return NextResponse.json(
        {
          error:
            '올바르지 않은 키캡 배열입니다.',
        },
        {
          status: 400,
        },
      );
    }

    if (
      !ALLOWED_ORDER_TYPES.includes(
        orderType as (
          typeof ALLOWED_ORDER_TYPES
        )[number],
      )
    ) {
      return NextResponse.json(
        {
          error:
            '올바르지 않은 접수 구분입니다.',
        },
        {
          status: 400,
        },
      );
    }

    if (
      eventCode.length > 8
    ) {
      return NextResponse.json(
        {
          error:
            '이벤트 코드는 최대 8자입니다.',
        },
        {
          status: 400,
        },
      );
    }

    if (!productName) {
      return NextResponse.json(
        {
          error:
            '상품명이 누락되었습니다.',
        },
        {
          status: 400,
        },
      );
    }

    /*
     * 5. Supabase Storage 업로드
     */
    const fileName =
      createSafeFileName(size, color);

    const nowDate = new Date();

    const year = String(
      nowDate.getUTCFullYear(),
    );

    const month = String(
      nowDate.getUTCMonth() + 1,
    ).padStart(2, '0');

    const day = String(
      nowDate.getUTCDate(),
    ).padStart(2, '0');

    // 예:
    // 2026/08/05/design_..._1x4_white.png
    const filePath =
      `${year}/${month}/${day}/${fileName}`;

    uploadedFilePath = filePath;

    const imageArrayBuffer =
      await imageValue.arrayBuffer();

    const imageBuffer =
      Buffer.from(imageArrayBuffer);

    const {
      error: storageError,
    } = await supabaseClient.storage
      .from('design-previews')
      .upload(
        filePath,
        imageBuffer,
        {
          contentType: 'image/png',
          cacheControl: '3600',
          upsert: false,
        },
      );

    if (storageError) {
      console.error(
        'Storage 업로드 오류:',
        storageError,
      );

      return NextResponse.json(
        {
          error:
            `시안 이미지 저장에 실패했습니다: ${storageError.message}`,
        },
        {
          status: 500,
        },
      );
    }

    /*
     * 6. 공개 URL 생성
     *
     * design-previews 버킷이 Public이어야
     * 이 URL로 이미지를 볼 수 있습니다.
     */
    const {
      data: publicUrlData,
    } = supabaseClient.storage
      .from('design-previews')
      .getPublicUrl(filePath);

    const publicUrl =
      publicUrlData.publicUrl;

    if (!publicUrl) {
      throw new Error(
        '시안 이미지 URL을 생성하지 못했습니다.',
      );
    }

    /*
     * 7. design_orders 테이블 저장
     *
     * id, created_at, state는 DB 기본값 사용
     */
    const {
      data: insertedOrder,
      error: dbError,
    } = await supabaseClient
      .from('design_orders')
      .insert({
        customer_name: customerName,
        contact,
        color,
        size,
        preview_image_url: publicUrl,
        order_type: orderType,

        // 빈 문자열이면 null로 저장
        event_code:
          eventCode || null,

        product_name: productName,

        // 테이블 컬럼명이 request이므로 그대로 사용
        request:
          requestMessage || null,

        // state는 DB의 PENDING 기본값을 사용하므로
        // 여기서는 보내지 않습니다.
      })
      .select('id, created_at')
      .single();

    if (dbError) {
      console.error(
        'design_orders 저장 오류:',
        dbError,
      );

      /*
       * DB 저장 실패 시 Storage에 올라간
       * 고아 이미지를 제거합니다.
       */
      await supabaseClient.storage
        .from('design-previews')
        .remove([filePath]);

      uploadedFilePath = null;

      return NextResponse.json(
        {
          error:
            `주문정보 저장에 실패했습니다: ${dbError.message}`,
        },
        {
          status: 500,
        },
      );
    }

    /*
     * 8. 성공 응답
     */
    return NextResponse.json({
      success: true,
      orderId: insertedOrder.id,
      createdAt: insertedOrder.created_at,
      previewImageUrl: publicUrl,
    });
  } catch (error: unknown) {
    console.error(
      'design-order API 오류:',
      error,
    );

    /*
     * 예상하지 못한 오류가 발생하고
     * 이미지가 이미 업로드된 경우 정리합니다.
     */
    if (uploadedFilePath) {
      try {
        await supabaseClient.storage
          .from('design-previews')
          .remove([uploadedFilePath]);
      } catch (cleanupError) {
        console.error(
          '업로드 파일 정리 실패:',
          cleanupError,
        );
      }
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : '알 수 없는 내부 서버 오류가 발생했습니다.',
      },
      {
        status: 500,
      },
    );
  }
}
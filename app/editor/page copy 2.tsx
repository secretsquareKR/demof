'use client';

import * as fabric from 'fabric';
import { useEffect, useRef, useState } from 'react';

const TARGET_WIDTH = 1000;

const SIZES = [
  { key: '1x1', cols: 1, rows: 1 },
  { key: '1x2', cols: 1, rows: 2 },
  { key: '2x1', cols: 2, rows: 1 },
  { key: '2x2', cols: 2, rows: 2 },
  { key: '2x3', cols: 2, rows: 3 },
  { key: '3x2', cols: 3, rows: 2 },
  { key: '3x3', cols: 3, rows: 3 },
  { key: '3x4', cols: 3, rows: 4 },
  { key: '4x3', cols: 4, rows: 3 },
];

export default function Editor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fabricCanvas = useRef<fabric.Canvas | null>(null);
  const uploadedImage = useRef<fabric.FabricImage | null>(null);

  const [showGuidePopup, setShowGuidePopup] = useState(true);
  const [slideIndex, setSlideIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState('1x1');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const guideBounds = useRef({ left: 0, top: 0, width: 0, height: 0 });

  const selectedSpec = SIZES.find((s) => s.key === selectedSize)!;

  // --- 호이스팅 및 any 제거를 위한 헬퍼 함수들 (useEffect 상단 배치) ---
  
  // any 타입을 피하기 위해 Record<string, unknown> 구조로 안전하게 타입 변환하여 확인
  const isGuideObject = (obj: fabric.FabricObject): boolean => {
    const customProps = obj as unknown as Record<string, unknown>;
    return customProps.isGuide === true;
  };

  const markAsGuideObject = (obj: fabric.FabricObject) => {
    const customProps = obj as unknown as Record<string, unknown>;
    customProps.isGuide = true;
  };

  const clearGuide = (canvas: fabric.Canvas) => {
    canvas.getObjects().forEach((obj) => {
      if (isGuideObject(obj)) {
        canvas.remove(obj);
      }
    });
  };

  // 가이드라인 객체들만 찾아 최상단 레이어로 올리는 함수
  const bringGuidesToFront = (canvas: fabric.Canvas) => {
    canvas.getObjects().forEach((obj) => {
      if (isGuideObject(obj)) {
        canvas.bringObjectToFront(obj);
      }
    });
    canvas.requestRenderAll();
  };

  const drawGuide = (canvas: fabric.Canvas, cols: number, rows: number) => {
    // 내부 렌더링 크기를 정확하게 가져오기 위해 메서드 호출
    const canvasW = canvas.getWidth();
    const canvasH = canvas.getHeight();

    // 1. 최대 가이드 영역 계산 (여백 확보)
    const maxGuideW = canvasW * 0.82;
    const maxGuideH = canvasH * 0.72;

    let guideW = maxGuideW;
    let guideH = guideW * (rows / cols);

    if (guideH > maxGuideH) {
      guideH = maxGuideH;
      guideW = guideH * (cols / rows);
    }

    // 소수점 깨짐 방지 및 정수화
    guideW = Math.floor(guideW);
    guideH = Math.floor(guideH);

    // 2. 정확한 좌상단 시작 좌표 계산 (정중앙 배치를 위함)
    const left = Math.floor((canvasW - guideW) / 2);
    const top = Math.floor((canvasH - guideH) / 2);

    // 전역 상태(Ref) 업데이트
    guideBounds.current = { left, top, width: guideW, height: guideH };

    // --- [1] 외곽 큰 사각형 (검은색 -> 빨간색 라인으로 변경) ---
    const outer = new fabric.Rect({
      left,
      top,
      width: guideW,
      height: guideH,
      originX: 'left',
      originY: 'top',
      fill: 'transparent',
      stroke: '#ef4444',     // 🔥 밝은 빨간색(Tailwind red-500)으로 변경
      strokeWidth: 2,
      strokeUniform: true,
      selectable: false,
      evented: false,
    });
    markAsGuideObject(outer);
    canvas.add(outer);

    // --- [2] 내부 키캡 분할선 격자 (진한 검은색 선으로 수정) ---
    const cellW = guideW / cols;
    const cellH = guideH / rows;

    // 세로 격자선 (Cols)
    for (let i = 1; i < cols; i++) {
      const x = Math.floor(left + cellW * i);
      const line = new fabric.Line([x, top, x, top + guideH], {
        stroke: '#111827',   // 🔥 진한 검은색(Tailwind gray-900)으로 변경
        strokeWidth: 2,      // 격자선이므로 두께는 1px 유지
        opacity: 0.8,        // 🔥 선명하게 보이도록 불투명도 상향
        selectable: false,
        evented: false,
      });
      markAsGuideObject(line);
      canvas.add(line);
    }

    // 가로 격자선 (Rows)
    for (let i = 1; i < rows; i++) {
      const y = Math.floor(top + cellH * i);
      const line = new fabric.Line([left, y, left + guideW, y], {
        stroke: '#111827',   // 🔥 진한 검은색(Tailwind gray-900)으로 변경
        strokeWidth: 2,
        opacity: 0.8,        // 🔥 선명하게 보이도록 불투명도 상향
        selectable: false,
        evented: false,
      });
      markAsGuideObject(line);
      canvas.add(line);
    }

    // --- [기존 3번 파란 점선 사각형 영역 삭제됨] ---

    // --- [3] 정중앙 크로스 타겟 가이드라인 ---
    // (이 부분은 격자가 검은색이 되었으므로, 중앙 정렬용 보조선으로 유지하거나 
    //  필요 없다면 지우셔도 됩니다. 일단 유용하니 연한 블루 대시선으로 유지했습니다.)
    const centerX = Math.floor(left + guideW / 2);
    const centerY = Math.floor(top + guideH / 2);

    const vCenter = new fabric.Line([centerX, top, centerX, top + guideH], {
      stroke: '#3b82f6',
      strokeWidth: 1,
      opacity: 0.3,
      strokeDashArray: [4, 4],
      selectable: false,
      evented: false,
    });

    const hCenter = new fabric.Line([left, centerY, left + guideW, centerY], {
      stroke: '#3b82f6',
      strokeWidth: 1,
      opacity: 0.3,
      strokeDashArray: [4, 4],
      selectable: false,
      evented: false,
    });

    markAsGuideObject(vCenter);
    markAsGuideObject(hCenter);
    canvas.add(vCenter);
    canvas.add(hCenter);

    // 변경사항 강제 동기화 렌더링
    canvas.requestRenderAll();
  };

  // --- React Lifecycle Effects ---

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const width = containerRef.current.offsetWidth;
    const height = width * 1.25;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width,
      height,
      backgroundColor: '#f8fafc',
      preserveObjectStacking: true,
      selection: false,
    });

    fabricCanvas.current = canvas;
    drawGuide(canvas, selectedSpec.cols, selectedSpec.rows);

    return () => {
      canvas.dispose();
    };
  }, []);

  useEffect(() => {
    const canvas = fabricCanvas.current;
    if (!canvas) return;

    clearGuide(canvas);
    drawGuide(canvas, selectedSpec.cols, selectedSpec.rows);

    if (uploadedImage.current) {
      //canvas.bringObjectToFront(uploadedImage.current);
      //canvas.setActiveObject(uploadedImage.current);
      canvas.setActiveObject(uploadedImage.current);
    }

    //canvas.requestRenderAll();
    bringGuidesToFront(canvas);
  }, [selectedSize]);

  // --- Image Event Handlers ---

const onUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const canvas = fabricCanvas.current;

    if (!file || !canvas) return;

    const reader = new FileReader();

    reader.onload = async (event) => {
      const img = await fabric.FabricImage.fromURL(event.target?.result as string);

      if (uploadedImage.current) {
        canvas.remove(uploadedImage.current);
      }

      const bounds = guideBounds.current;

      img.set({
        left: bounds.left + bounds.width / 2,
        top: bounds.top + bounds.height / 2,
        originX: 'center',
        originY: 'center',
        cornerStyle: 'circle',
        transparentCorners: false,
        borderColor: '#2563eb',
        cornerColor: '#2563eb',
      });

      img.scaleToWidth(bounds.width * 0.9);

      uploadedImage.current = img;

      canvas.add(img);
      canvas.setActiveObject(img);
      
      // 🔥 [수정] 사진이 추가된 후 가이드라인을 최상단으로 올림
      bringGuidesToFront(canvas); 
    };

    reader.readAsDataURL(file);
  };


  const zoomImage = (ratio: number) => {
    const canvas = fabricCanvas.current;
    const img = uploadedImage.current;

    if (!canvas || !img) return;

    img.scale((img.scaleX || 1) * ratio);
    canvas.requestRenderAll();
  };

  const centerImage = () => {
    const canvas = fabricCanvas.current;
    const img = uploadedImage.current;

    if (!canvas || !img) return;

    const bounds = guideBounds.current;

    img.set({
      left: bounds.left + bounds.width / 2,
      top: bounds.top + bounds.height / 2,
      originX: 'center',
      originY: 'center',
    });

    canvas.setActiveObject(img);
    canvas.requestRenderAll();
  };

  const resetImage = () => {
    const canvas = fabricCanvas.current;
    const img = uploadedImage.current;

    if (!canvas || !img) return;

    const bounds = guideBounds.current;

    img.set({
      angle: 0,
      left: bounds.left + bounds.width / 2,
      top: bounds.top + bounds.height / 2,
      originX: 'center',
      originY: 'center',
    });

    img.scaleToWidth(bounds.width * 0.9);

    canvas.setActiveObject(img);
    canvas.requestRenderAll();
  };

  const handleSave = () => {
    const canvas = fabricCanvas.current;

    if (!canvas) return;

    canvas.discardActiveObject();

    canvas.getObjects().forEach((obj) => {
      if (isGuideObject(obj)) {
        obj.set({ visible: false });
      }
    });

    const bounds = guideBounds.current;
    const multiplier = TARGET_WIDTH / bounds.width;

    const dataUrl = canvas.toDataURL({
      format: 'png',
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
      multiplier,
    });

    canvas.getObjects().forEach((obj) => {
      if (isGuideObject(obj)) {
        obj.set({ visible: true });
      }
    });

    canvas.requestRenderAll();
    setPreviewUrl(dataUrl);
  };

  const slides = [
    {
      title: '1. 주문한 사이즈를 선택해주세요',
      desc: '구매하신 키캡키링 사이즈와 같은 옵션을 선택해야 정확하게 제작됩니다.',
    },
    {
      title: '2. 사진을 업로드해주세요',
      desc: '얼굴, 반려동물, 로고처럼 중요한 부분이 선명한 사진을 추천합니다.',
    },
    {
      title: '3. 파란 점선 안쪽에 맞춰주세요',
      desc: '파란 점선 안쪽이 안전 영역입니다. 중요한 부분이 경계선에 걸리지 않게 배치해주세요.',
    },
  ];

  // 주문 폼 노출 여부 상태
  const [showOrderForm, setShowOrderForm] = useState(false);
  // 편집이 완료된 이미지 프리뷰 스토리지 (Supabase 업로드용 또는 미리보기용)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  
  // 주문서 생성을 위한 Ref 영역 (유저 입력 제어)
  const orderFormRef = useRef<HTMLDivElement>(null);

  // 주문 폼 데이터 상태
  const [orderData, setOrderData] = useState({
    orderType: '주문전', // '주문고객' 또는 '주문전'
    customerName: '',
    contact: '',
    boardColor: '블랙',
  });

const handleDesignComplete = () => {
    const canvas = fabricCanvas.current;
    if (!canvas) return;

    // 1. 활성화된 객체 선택 해제 및 포커스 아웃
    canvas.discardActiveObject();

    // 2. 모든 가이드라인 객체 숨기기 + 업로드된 사진 상태 강제 초기화
    canvas.getObjects().forEach((obj) => {
      if (isGuideObject(obj)) {
        obj.set({ visible: false });
      }
    });

    // 🔥 [추가 방어] 업로드된 사진 레이어의 투명도나 필터가 꼬여있을 수 있으므로 강제 세팅
    if (uploadedImage.current) {
      uploadedImage.current.set({
        opacity: 1,        // 투명도 100% 강제 고정
        filters: [],       // 혹시 모를 내부 필터 초기화
      });
      uploadedImage.current.applyFilters(); // 필터 변경사항 적용
    }
    
    // 숨김 및 상태 변경사항 캔버스 전역 반영
    canvas.requestRenderAll();

    // 3. 고화질 데이터 URL 추출
    const bounds = guideBounds.current;
    const multiplier = TARGET_WIDTH / bounds.width;

    const dataUrl = canvas.toDataURL({
      format: 'png',
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
      multiplier: multiplier,
      quality: 1,
      // 🔥 [추가 방어] 레티나 디스플레이의 알파 채널 중첩으로 인한 색상 왜곡 방지
      enableRetinaScaling: false, 
    });

    // 4. 가이드라인 객체들을 다시 화면에 노출 (UI 복구)
    canvas.getObjects().forEach((obj) => {
      if (isGuideObject(obj)) {
        obj.set({ visible: true });
      }
    });
    
    // 사진이 가이드보다 뒤로 가도록 스택 순서 동기화
    bringGuidesToFront(canvas);
    canvas.requestRenderAll();

    // 5. 폼 활성화 및 이미지 바인딩
    setPreviewImageUrl(dataUrl);
    setShowOrderForm(true);

    // 6. 부드러운 스크롤 포커싱
    setTimeout(() => {
      orderFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };



  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // TODO: Supabase 업로드 로직 통합 예정 (previewImageUrl을 활용하여 업로드)
    console.log("제출될 주문 데이터:", orderData);
    console.log("Supabase에 업로드될 이미지(Base64):", previewImageUrl?.substring(0, 50) + "...");
    
    alert("주문 제작 신청이 완료되었습니다!");
  };


  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6">
      {showGuidePopup && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4"
          style={{ touchAction: 'auto' }}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
            style={{ touchAction: 'auto' }}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex h-36 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <div className="text-center">
                <div className="mb-2 text-4xl font-black">
                  {slideIndex + 1}
                </div>
                <div className="text-sm font-semibold">
                  PHOTO KEYCAP GUIDE
                </div>
              </div>
            </div>

            <h2 className="mb-2 text-xl font-black text-gray-900">
              {slides[slideIndex].title}
            </h2>

            <p className="mb-6 text-sm leading-6 text-gray-600">
              {slides[slideIndex].desc}
            </p>

            <div className="mb-5 flex justify-center gap-2">
              {slides.map((_, i) => (
                <div
                  key={i}
                  className={`h-2 rounded-full transition-all ${
                    i === slideIndex ? 'w-6 bg-blue-600' : 'w-2 bg-gray-300'
                  }`}
                />
              ))}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSlideIndex((prev) => Math.max(0, prev - 1))}
                disabled={slideIndex === 0}
                className="flex-1 rounded-xl border border-gray-200 py-3 font-bold text-gray-600 disabled:opacity-30"
              >
                이전
              </button>

              {slideIndex < slides.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setSlideIndex((prev) => prev + 1)}
                  className="flex-1 rounded-xl bg-blue-600 py-3 font-bold text-white"
                >
                  다음
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowGuidePopup(false)}
                  className="flex-1 rounded-xl bg-blue-600 py-3 font-bold text-white"
                >
                  시작하기
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto flex w-full max-w-[520px] flex-col gap-5">
        <header>
          <h1 className="text-2xl font-black text-gray-900">
            포토 키캡키링 편집
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            주문하신 사이즈를 선택하고 사진을 가이드에 맞춰주세요.
          </p>
        </header>

        <section className="rounded-3xl bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-gray-900">사이즈 선택</h2>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
              {selectedSize}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {SIZES.map((size) => (
              <button
                type="button"
                key={size.key}
                onClick={() => {
                  setSelectedSize(size.key);
                  setPreviewImageUrl(null); // 다른 크기 선택 시 프리뷰 초기화 동기화
                  setShowOrderForm(false);
                }}
                className={`rounded-2xl border p-3 transition ${
                  selectedSize === size.key
                    ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm'
                    : 'border-gray-200 bg-white text-gray-700'
                }`}
              >
                <div className="flex h-12 items-center justify-center">
                  <div
                    className="grid gap-[2px]"
                    style={{
                      gridTemplateColumns: `repeat(${size.cols}, 12px)`,
                      gridTemplateRows: `repeat(${size.rows}, 12px)`,
                    }}
                  >
                    {Array.from({ length: size.cols * size.rows }).map((_, i) => (
                      <div
                        key={i}
                        className="h-[12px] w-[12px] rounded-[2px] bg-current opacity-70"
                      />
                    ))}
                  </div>
                </div>

                <div className="mt-2 text-sm font-black">{size.key}</div>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-3xl bg-white p-4 shadow-sm">
          <label className="mb-2 block font-bold text-gray-900">
            사진 업로드
          </label>

          <input
            type="file"
            accept="image/*"
            onChange={onUploadImage}
            className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-full file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-bold file:text-blue-700 hover:file:bg-blue-100"
          />
        </section>

        <section className="rounded-3xl bg-white p-4 shadow-sm">
          <div
            ref={containerRef}
            className="w-full overflow-hidden rounded-2xl border border-gray-200 bg-slate-100"
            style={{ touchAction: 'none' }}
          >
            <canvas ref={canvasRef} />
          </div>

          <p className="mt-3 text-center text-xs leading-5 text-gray-500">
            빨간색 영역 안으로 각인될 이미지를 위치시켜주세요.<br />
            격자무늬는 실제 키캡간의 경계라인입니다.
          </p>

          <div className="mt-4 grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => zoomImage(1.1)}
              className="rounded-xl bg-gray-100 py-3 text-sm font-bold text-gray-700"
            >
              확대
            </button>

            <button
              type="button"
              onClick={() => zoomImage(0.9)}
              className="rounded-xl bg-gray-100 py-3 text-sm font-bold text-gray-700"
            >
              축소
            </button>

            <button
              type="button"
              onClick={centerImage}
              className="rounded-xl bg-gray-100 py-3 text-sm font-bold text-gray-700"
            >
              가운데
            </button>

            <button
              type="button"
              onClick={resetImage}
              className="rounded-xl bg-gray-100 py-3 text-sm font-bold text-gray-700"
            >
              초기화
            </button>
          </div>
        </section>

        {/* 🔥 [수정 포인트] onClick 핸들러를 기존 handleSave에서 폼을 열어주고 스크롤해주는 handleDesignComplete로 교체 */}
        <button
          type="button"
          onClick={handleDesignComplete}
          className="rounded-2xl bg-blue-600 py-4 text-lg font-black text-white shadow-lg transition active:scale-95"
        >
          편집 완료
        </button>

        {/* 주문자 정보 입력 및 미리보기 섹션 */}
        {showOrderForm && (
          <div 
            ref={orderFormRef} 
            className="border-t border-gray-200 pt-8 space-y-8 transition-all duration-500 animate-fadeIn"
          >
            <div className="grid grid-cols-1 gap-8">
              
              {/* 각인될 이미지 미리보기 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-950">각인 이미지 미리보기</h3>
                <div className="border border-white-200 bg-white p-4 rounded-xl flex items-center justify-center max-h-[400px] overflow-hidden shadow-sm">
                  {previewImageUrl && (
                    <img 
                      src={previewImageUrl} 
                      alt="각인 미리보기" 
                      className="object-contain max-h-[360px] w-full"
                    />
                  )}
                </div>
              </div>

              {/* 주문자 정보 입력 폼 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-950">주문자 정보 입력</h3>
                
                <form onSubmit={handleOrderSubmit} className="space-y-4 bg-slate-50 p-6 rounded-xl border border-slate-100">
                  {/* 1) 주문 단계 선택 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">주문 상태 선택</label>
                    <div className="flex gap-4">
                      {['주문고객', '주문전'].map((type) => (
                        <label key={type} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                          <input
                            type="radio"
                            name="orderType"
                            value={type}
                            checked={orderData.orderType === type}
                            onChange={(e) => setOrderData({ ...orderData, orderType: e.target.value })}
                            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                          />
                          {type}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* 2) 주문자 성함 */}
                  <div>
                    <label htmlFor="customerName" className="block text-sm font-medium text-gray-700 mb-1">
                      주문자 성함
                    </label>
                    <input
                      type="text"
                      id="customerName"
                      required
                      value={orderData.customerName}
                      onChange={(e) => setOrderData({ ...orderData, customerName: e.target.value })}
                      placeholder="홍길동"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>

                  {/* 3) 주문자 연락처 */}
                  <div>
                    <label htmlFor="contact" className="block text-sm font-medium text-gray-700 mb-1">
                      주문자 연락처
                    </label>
                    <input
                      type="tel"
                      id="contact"
                      required
                      value={orderData.contact}
                      onChange={(e) => setOrderData({ ...orderData, contact: e.target.value })}
                      placeholder="01012345678 -없이 입력"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>

                  {/* 4) 보드 색상 선택 (라디오 버튼) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">보드 색상</label>
                    <div className="flex flex-wrap gap-4">
                      {['블랙', '화이트', '핑크', ...(selectedSize === '3x3' ? ['투명'] : [])].map((color) => (
                        <label key={color} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                          <input
                            type="radio"
                            name="boardColor"
                            value={color}
                            checked={orderData.boardColor === color}
                            onChange={(e) => setOrderData({ ...orderData, boardColor: e.target.value })}
                            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                          />
                          {color}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* 최하단 추천 제출 버튼 */}
                  <div className="pt-4">
                    <button
                      type="submit"
                      className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                      주문 제작 신청하기
                    </button>
                  </div>
                </form>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
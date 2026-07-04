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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fabricCanvas = useRef<fabric.Canvas | null>(null);
  const uploadedImage = useRef<fabric.FabricImage | null>(null);

  const [showGuidePopup, setShowGuidePopup] = useState(true);
  const [slideIndex, setSlideIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState('1x1');
  const [hasImage, setHasImage] = useState(false); 
  const [isSubmitting, setIsSubmitting] = useState(false); 

  const guideBounds = useRef({ left: 0, top: 0, width: 0, height: 0 });
  const selectedSpec = SIZES.find((s) => s.key === selectedSize)!;

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

  const bringGuidesToFront = (canvas: fabric.Canvas) => {
    canvas.getObjects().forEach((obj) => {
      if (isGuideObject(obj)) {
        canvas.bringObjectToFront(obj);
      }
    });
    canvas.requestRenderAll();
  };

  const drawGuide = (canvas: fabric.Canvas, cols: number, rows: number) => {
    const canvasW = canvas.getWidth();
    const canvasH = canvas.getHeight();

    const maxGuideW = canvasW * 0.82;
    const maxGuideH = canvasH * 0.72;

    let guideW = maxGuideW;
    let guideH = guideW * (rows / cols);

    if (guideH > maxGuideH) {
      guideH = maxGuideH;
      guideW = guideH * (cols / rows);
    }

    guideW = Math.floor(guideW);
    guideH = Math.floor(guideH);

    const left = Math.floor((canvasW - guideW) / 2);
    const top = Math.floor((canvasH - guideH) / 2);

    guideBounds.current = { left, top, width: guideW, height: guideH };

    const outer = new fabric.Rect({
      left,
      top,
      width: guideW,
      height: guideH,
      originX: 'left',
      originY: 'top',
      fill: 'transparent',
      stroke: '#ef4444',
      strokeWidth: 2,
      strokeUniform: true,
      selectable: false,
      evented: false,
    });
    markAsGuideObject(outer);
    canvas.add(outer);

    const cellW = guideW / cols;
    const cellH = guideH / rows;

    for (let i = 1; i < cols; i++) {
      const x = Math.floor(left + cellW * i);
      const whiteLine = new fabric.Line([x, top, x, top + guideH], {
        stroke: '#ffffff',
        strokeWidth: 2.5,
        opacity: 0.7,
        selectable: false,
        evented: false,
      });
      const blackLine = new fabric.Line([x, top, x, top + guideH], {
        stroke: '#111827',
        strokeWidth: 1,
        opacity: 0.85,
        selectable: false,
        evented: false,
      });
      markAsGuideObject(whiteLine);
      markAsGuideObject(blackLine);
      canvas.add(whiteLine);
      canvas.add(blackLine);
    }

    for (let i = 1; i < rows; i++) {
      const y = Math.floor(top + cellH * i);
      const whiteLine = new fabric.Line([left, y, left + guideW, y], {
        stroke: '#ffffff',
        strokeWidth: 2.5,
        opacity: 0.7,
        selectable: false,
        evented: false,
      });
      const blackLine = new fabric.Line([left, y, left + guideW, y], {
        stroke: '#111827',
        strokeWidth: 1,
        opacity: 0.85,
        selectable: false,
        evented: false,
      });
      markAsGuideObject(whiteLine);
      markAsGuideObject(blackLine);
      canvas.add(whiteLine);
      canvas.add(blackLine);
    }

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

    canvas.requestRenderAll();
  };

  const [showOrderForm, setShowOrderForm] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const orderFormRef = useRef<HTMLDivElement>(null);
  
    const handleCanvasObjectModified = () => {
    setShowOrderForm(false);
    setPreviewImageUrl(null);
  };


  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const width = containerRef.current.offsetWidth;
    const height = width * 1.5;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width,
      height,
      backgroundColor: '#f8fafc',
      preserveObjectStacking: true,
      selection: false,
      allowTouchScrolling: true,
    });

    fabricCanvas.current = canvas;
    drawGuide(canvas, selectedSpec.cols, selectedSpec.rows);

    
    canvas.on('object:moving', handleCanvasObjectModified);
    canvas.on('object:scaling', handleCanvasObjectModified);

    const upperCanvasEl = canvas.upperCanvasEl;
    if (upperCanvasEl) {
      upperCanvasEl.addEventListener('touchstart', () => {
        const activeObject = canvas.getActiveObject();
        if (!activeObject) {
          upperCanvasEl.style.touchAction = 'pan-y';
        } else {
          upperCanvasEl.style.touchAction = 'none';
        }
      }, { passive: true });
    }

    return () => {
      canvas.off('object:moving', handleCanvasObjectModified);
      canvas.off('object:scaling', handleCanvasObjectModified);
      canvas.dispose();
    };
  }, []);

  useEffect(() => {
    const canvas = fabricCanvas.current;
    if (!canvas) return;

    clearGuide(canvas);
    drawGuide(canvas, selectedSpec.cols, selectedSpec.rows);

    if (uploadedImage.current) {
      canvas.setActiveObject(uploadedImage.current);
    }
    bringGuidesToFront(canvas);
  }, [selectedSize]);

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
      
      bringGuidesToFront(canvas);
      setHasImage(true); 
      handleCanvasObjectModified(); 
    };

    reader.readAsDataURL(file);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const zoomImage = (ratio: number) => {
    const canvas = fabricCanvas.current;
    const img = uploadedImage.current;
    if (!canvas || !img) return;
    img.scale((img.scaleX || 1) * ratio);
    canvas.requestRenderAll();
    handleCanvasObjectModified();
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
    handleCanvasObjectModified();
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
    handleCanvasObjectModified();
  };


  // 💡 orderType 기본값을 '주문전'으로 픽스하고 eventCode 상태 추가
  const [orderData, setOrderData] = useState({
    orderType: '주문전',
    customerName: '',
    contact: '',
    boardColor: '블랙',
    eventCode: '',
  });

  const handleDesignComplete = () => {
    const canvas = fabricCanvas.current;
    if (!canvas) return;
    if (!hasImage) {
      alert('사진을 먼저 첨부해 주세요.');
      return;
    }

    canvas.discardActiveObject();
    canvas.getObjects().forEach((obj) => {
      if (isGuideObject(obj)) {
        obj.set({ visible: false });
      }
    });

    if (uploadedImage.current) {
      uploadedImage.current.set({
        opacity: 1,
        filters: [],
      });
      uploadedImage.current.applyFilters();
    }
    
    canvas.requestRenderAll();

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
      enableRetinaScaling: false,
    });

    canvas.getObjects().forEach((obj) => {
      if (isGuideObject(obj)) {
        obj.set({ visible: true });
      }
    });
    
    bringGuidesToFront(canvas);
    canvas.requestRenderAll();

    setPreviewImageUrl(dataUrl);
    setShowOrderForm(true);

    setTimeout(() => {
      orderFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedName = orderData.customerName.trim();
    if (!trimmedName) {
      alert('주문자 이름을 입력해 주세요.');
      return;
    }
    if (trimmedName.length > 15) {
      alert('이름은 최대 15글자까지만 입력 가능합니다.');
      return;
    }

    const contactNum = orderData.contact;
    const is010Valid = /^010[0-9]{8}$/.test(contactNum);
    const is050Valid = /^050[0-9]{9}$/.test(contactNum);

    if (!is010Valid && !is050Valid) {
      if (contactNum.startsWith('010') && contactNum.length !== 11) {
        alert('010으로 시작하는 번호는 총 11자리 숫자여야 합니다. 다시 확인해주세요.');
      } else if (contactNum.startsWith('050') && contactNum.length !== 12) {
        alert('050으로 시작하는 안심번호는 총 12자리 숫자여야 합니다. 다시 확인해주세요.');
      } else {
        alert('올바른 연락처 형식이 아닙니다. 010 또는 050으로 시작하는 번호를 입력해 주세요.');
      }
      return;
    }

    const currentPreviewUrl = previewImageUrl; 
    if (!currentPreviewUrl || currentPreviewUrl.includes('null')) {
      alert('이미지 주소가 올바르지 않거나 수정되었습니다. 다시 편집 완료를 눌러주세요.');
      return;
    }

    try {
      setIsSubmitting(true); 

      // 💡 body 데이터에 eventCode 바인딩 추가
      const res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: orderData.customerName,
          contact: orderData.contact,
          boardColor: orderData.boardColor,
          selectedSize,
          previewUrl: currentPreviewUrl,
          orderType: orderData.orderType,
          eventCode: orderData.eventCode.trim() 
        }),
      });

      if (res.status === 429) {
        alert('단시간에 너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해 주세요.');
        setIsSubmitting(false);
        return;
      }

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      alert('주문 제작 신청이 성공적으로 완료되었습니다!');
      setPreviewImageUrl(null); 
      window.location.reload();

    } catch (error: unknown) {
      console.error('에러 발생:', error);
      if (error instanceof Error) alert(error.message);
      setIsSubmitting(false); 
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const sanitizedValue = value.replace(/[^a-zA-Z가-힣ㄱ-ㅎㅏ-ㅣ\s]/g, '');
    if (sanitizedValue.length <= 15) {
      setOrderData((prev) => ({ ...prev, customerName: sanitizedValue }));
    }
  };

  const handleContactChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const onlyNums = value.replace(/[^0-9]/g, '');
    if (onlyNums.length <= 12) {
      setOrderData((prev) => ({ ...prev, contact: onlyNums }));
    }
  };

  const slides = [
    {
      title: '1. 스위치보드 사이즈를 선택해주세요',
      desc: '사진이 가장 잘 각인될 규격의 스위치보드를 찾아 선택해주세요..!',
    },
    {
      title: '2. 사진을 업로드해주세요',
      desc: '최대한 선명한 이미지를 선택해주세요.',
    },
    {
      title: '3. 가이드 라인을 참고해서 이미지를 조정해주세요.',
      desc: '빨간 테두리가 실제 각인되는 영역입니다. 키캡 경계선을 고려하셔서 이미지 위치를 조정해주세요.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6">
      {isSubmitting && (
        <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-black/70 px-4 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent mb-4"></div>
          <p className="text-xl font-bold text-white">사진 및 주문서 업로드 중...</p>
          <p className="text-sm text-gray-300 mt-2">짧게는 5초, 길게는 10초정도 소요됩니다. 잠시만 기다려주세요!</p>
        </div>
      )}

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
            <div className="text-xl mb-3 font-semibold">PHOTO KEYCAP GUIDE</div>
            <h2 className="text-xl mb-4 font-black text-gray-900">{slides[slideIndex].title}</h2>
            <p className="mb-6 text-sm leading-6 text-gray-600">{slides[slideIndex].desc}</p>

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
          <h1 className="text-2xl font-black text-gray-900">포토 키캡키링 편집</h1>
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
                  setPreviewImageUrl(null);
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

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onUploadImage}
          className="hidden"
        />

        <section className="rounded-3xl bg-white p-4 shadow-sm">
          <div className="relative w-full overflow-hidden rounded-2xl border border-gray-200 bg-slate-100">
            {!hasImage && (
              <div 
                onClick={triggerFileInput}
                className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-100/90 cursor-pointer p-6 text-center hover:bg-slate-200/80 transition-all gap-2"
              >
                <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </div>
                <span className="text-base font-bold text-gray-900">클릭하여 사진 첨부하기</span>
                <span className="text-xs text-gray-500">스마트폰 앨범 또는 PC 보관함에서 사진을 선택해 주세요.</span>
              </div>
            )}

            <div ref={containerRef} className="w-full" style={{ touchAction: 'pan-y' }}>
              <canvas ref={canvasRef} />
            </div>
          </div>

          <p className="mt-3 text-center text-xs leading-5 text-gray-500">
            빨간색 영역 안으로 각인될 이미지를 위치시켜주세요.<br />
            격자무늬는 실제 키캡간의 경계라인입니다.
          </p>

          <div className="mt-4 grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => zoomImage(1.1)}
              className="rounded-xl bg-gray-100 py-3 text-sm font-bold text-gray-700 disabled:opacity-40"
              disabled={!hasImage}
            >
              확대
            </button>
            <button
              type="button"
              onClick={() => zoomImage(0.9)}
              className="rounded-xl bg-gray-100 py-3 text-sm font-bold text-gray-700 disabled:opacity-40"
              disabled={!hasImage}
            >
              축소
            </button>
            <button
              type="button"
              onClick={centerImage}
              className="rounded-xl bg-gray-100 py-3 text-sm font-bold text-gray-700 disabled:opacity-40"
              disabled={!hasImage}
            >
              가운데
            </button>
            <button
              type="button"
              onClick={resetImage}
              className="rounded-xl bg-gray-100 py-3 text-sm font-bold text-gray-700 disabled:opacity-40"
              disabled={!hasImage}
            >
              초기화
            </button>
          </div>

          {hasImage && (
            <button
              type="button"
              onClick={triggerFileInput}
              className="w-full mt-2 rounded-xl border border-dashed border-gray-300 bg-white py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              다른 사진으로 변경하기
            </button>
          )}
        </section>

        <button
          type="button"
          onClick={handleDesignComplete}
          className="rounded-2xl bg-blue-600 py-4 text-lg font-black text-white shadow-lg transition active:scale-95 disabled:bg-gray-300 disabled:scale-100"
          disabled={!hasImage}
        >
          {showOrderForm ? '✔️ 편집 정보가 반영되었습니다' : '편집 완료'}
        </button>

        {showOrderForm && (
          <div 
            ref={orderFormRef} 
            className="border-t border-gray-200 pt-8 space-y-8 transition-all duration-500 animate-fadeIn"
          >
            <div className="grid grid-cols-1 gap-8">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-950">주문자 정보 입력</h3>
                
                <form onSubmit={handleOrderSubmit} className="space-y-4 bg-slate-50 p-6 rounded-xl border border-slate-100">
                  
                  {/* 1) 주문자 성함 */}
                  <div>
                    <label htmlFor="customerName" className="block text-sm font-medium text-gray-700 mb-1">
                      주문자 성함
                    </label>
                    <input
                      type="text"
                      id="customerName"
                      required
                      value={orderData.customerName}
                      onChange={handleNameChange}
                      placeholder="홍길동"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900 placeholder-gray-400"
                    />
                  </div>

                  {/* 2) 주문자 연락처 */}
                  <div>
                    <label htmlFor="contact" className="block text-sm font-medium text-gray-700 mb-1">
                      주문자 연락처
                    </label>
                    <input
                      type="tel"
                      id="contact"
                      required
                      value={orderData.contact}
                      onChange={handleContactChange}
                      placeholder="01012345678 -없이 입력"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900 placeholder-gray-400"
                    />
                  </div>

                  {/* 3) 보드 색상 선택 */}
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

                  {/* 💡 4) 이벤트 코드 입력 란 (선택 사항) */}
                  <div>
                    <label htmlFor="eventCode" className="block text-sm font-medium text-gray-700 mb-1">
                      이벤트 코드 <span className="text-xs text-gray-400 font-normal">(선택사항)</span>
                    </label>
                    <input
                      type="text"
                      id="eventCode"
                      value={orderData.eventCode}
                      onChange={(e) => setOrderData({ ...orderData, eventCode: e.target.value })}
                      placeholder="발급받으신 코드가 있다면 입력해주세요"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900 placeholder-gray-400"
                    />
                  </div>

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
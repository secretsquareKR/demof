'use client';

import * as fabric from 'fabric';
import { useEffect, useRef, useState } from 'react';

const UNIT_PIXELS = 250; 

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

const BOARD_COLORS = [
  {
    name: '블랙',
    hex: '#1f2937',
  },
  {
    name: '화이트',
    hex: '#ffffff',
  },
  {
    name: '핑크',
    hex: '#f9a8d4',
  },
  {
    name: '레드',
    hex: '#ef4444',
  },
  {
    name: '오렌지',
    hex: '#f97316',
  },
  {
    name: '옐로우',
    hex: '#facc15',
  },
  {
    name: '라이트그린',
    hex: '#97ffc3',
  },
  {
    name: '그린',
    hex: '#047c00',
  },
  {
    name: '블루',
    hex: '#2563eb',
  },
  {
    name: '스카이블루',
    hex: '#38bdf8',
  },
  {
    name: '그레이',
    hex: '#9ca3af',
  },
  {
    name: '네이비',
    hex: '#00006e',
  },
];

const SMART_STORE_PRODUCT_URL =
  'https://mkt.shopping.naver.com/link/69e9caa8d02ed2467ac4ce01'; // 실제 상품 링크로 변경 가능

type SubmittedOrder = {
  size: string;
  boardColor: string;
  previewImageUrl: string;
};

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

    const maskPathString = `
      M 0 0 H ${canvasW} V ${canvasH} H 0 Z 
      M ${left} ${top} H ${left + guideW} V ${top + guideH} H ${left} Z
    `;

    const shadowMask = new fabric.Path(maskPathString, {
      fill: 'rgba(17, 24, 39, 0.80)', 
      fillRule: 'evenodd',           
      selectable: false,
      evented: false, 
    });
    markAsGuideObject(shadowMask);
    canvas.add(shadowMask);

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
        strokeWidth: 3.5,
        opacity: 0.7,
        selectable: false,
        evented: false,
      });
      const blackLine = new fabric.Line([x, top, x, top + guideH], {
        stroke: '#111827',
        strokeWidth: 2.5,
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
        strokeWidth: 3.5,
        opacity: 0.7,
        selectable: false,
        evented: false,
      });
      const blackLine = new fabric.Line([left, y, left + guideW, y], {
        stroke: '#111827',
        strokeWidth: 2.5,
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
      stroke: '#8b5cf6',
      strokeWidth: 1,
      opacity: 0.35,
      strokeDashArray: [4, 4],
      selectable: false,
      evented: false,
    });

    const hCenter = new fabric.Line([left, centerY, left + guideW, centerY], {
      stroke: '#8b5cf6',
      strokeWidth: 1,
      opacity: 0.35,
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
  const [submittedOrder, setSubmittedOrder] = useState<SubmittedOrder | null>(null);
  const orderFormRef = useRef<HTMLDivElement>(null);
  const orderCompleteRef = useRef<HTMLDivElement>(null);

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
      backgroundColor: '#ffffff', 
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
    upperCanvasEl.addEventListener('touchstart', (e: TouchEvent) => {
      // 💡 target 변수에서 실제 FabricObject인 'target' 속성을 구조 분해 할당으로 추출합니다.
      const findResult = canvas.findTarget(e);
      const actualTarget = findResult?.target; // 실제 만겨진 FabricObject 픽업
      
      // 💡 actualTarget(진짜 사진 객체)이 존재하고 가이드라인 객체가 아닐 때만 스크롤 잠금
      if (actualTarget && !isGuideObject(actualTarget)) {
        upperCanvasEl.style.touchAction = 'none';
      } else {
        upperCanvasEl.style.touchAction = 'pan-y';
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
        borderColor: '#8b5cf6', 
        cornerColor: '#8b5cf6', 
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
    bringGuidesToFront(canvas); 
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
    bringGuidesToFront(canvas); 
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
      flipX: false,
      flipY: false,
    });
    img.scaleToWidth(bounds.width * 0.9);
    canvas.setActiveObject(img);
    canvas.requestRenderAll();
    bringGuidesToFront(canvas); 
    handleCanvasObjectModified();
  };

  const rotateImage90 = () => {
    const canvas = fabricCanvas.current;
    const img = uploadedImage.current;
    if (!canvas || !img) return;
    
    const currentAngle = img.angle || 0;
    img.set({ angle: (currentAngle + 90) % 360 });
    canvas.requestRenderAll();
    bringGuidesToFront(canvas); 
    handleCanvasObjectModified();
  };

  const flipImageX = () => {
    const canvas = fabricCanvas.current;
    const img = uploadedImage.current;
    if (!canvas || !img) return;
    
    img.set({ flipX: !img.flipX });
    canvas.requestRenderAll();
    bringGuidesToFront(canvas); 
    handleCanvasObjectModified();
  };

  const flipImageY = () => {
    const canvas = fabricCanvas.current;
    const img = uploadedImage.current;
    if (!canvas || !img) return;
    
    img.set({ flipY: !img.flipY });
    canvas.requestRenderAll();
    bringGuidesToFront(canvas); 
    handleCanvasObjectModified();
  };

  const [orderData, setOrderData] = useState({
    orderType: '주문전',
    customerName: '',
    contact: '',
    boardColor: '블랙',
    eventCode: '',
  });

  useEffect(() => {
  if (selectedSize !== '3x3' && orderData.boardColor === '투명') {
    setOrderData((prev) => ({
      ...prev,
      boardColor: '블랙',
    }));
  }
}, [selectedSize, orderData.boardColor]);

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
    const targetWidth = selectedSpec.cols * UNIT_PIXELS;
    const multiplier = targetWidth / bounds.width;

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

    if (orderData.eventCode.trim().length > 8) {
      alert('이벤트 코드는 최대 8자리까지만 입력 가능합니다.');
      return;
    }

    const currentPreviewUrl = previewImageUrl; 
    if (!currentPreviewUrl || currentPreviewUrl.includes('null')) {
      alert('이미지 주소가 올바르지 않거나 수정되었습니다. 다시 편집 완료를 눌러주세요.');
      return;
    }

    try {
      setIsSubmitting(true); 

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

      setSubmittedOrder({
        size: selectedSize,
        boardColor: orderData.boardColor,
        previewImageUrl: currentPreviewUrl,
      });

      setShowOrderForm(false);
      setIsSubmitting(false);

      setTimeout(() => {
        orderCompleteRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 100);

    } catch (error: unknown) {
      console.error('에러 발생:', error);
      if (error instanceof Error) alert(error.message);
      setIsSubmitting(false); 
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length <= 15) {
      setOrderData((prev) => ({ ...prev, customerName: value }));
    }
  };

  const handleContactChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const onlyNums = value.replace(/[^0-9]/g, '');
    if (onlyNums.length <= 12) {
      setOrderData((prev) => ({ ...prev, contact: onlyNums }));
    }
  };

  const handleEventCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length <= 8) {
      setOrderData((prev) => ({ ...prev, eventCode: value }));
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
    <div className="min-h-screen bg-[#faf8ff] text-gray-900 dark:bg-[#faf8ff] dark:text-gray-900 px-4 py-6">
      {isSubmitting && (
        <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-black/70 px-4 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent mb-4"></div>
          <p className="text-xl font-bold text-white">사진 및 주문서 업로드 중...</p>
          <p className="text-sm text-gray-300 mt-2">서버 최적화 완료! 잠시만 기다려주시면 금방 전송됩니다.</p>
        </div>
      )}

      {showGuidePopup && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4"
          style={{ touchAction: 'auto' }}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl dark:bg-white text-gray-900 dark:text-gray-900"
            style={{ touchAction: 'auto' }}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xl mb-3 font-semibold text-purple-900 dark:text-purple-900 tracking-wide">PHOTO KEYCAP GUIDE</div>
            <h2 className="text-xl mb-4 font-black text-gray-900 dark:text-gray-900">{slides[slideIndex].title}</h2>
            <p className="mb-6 text-sm leading-6 text-gray-600 dark:text-gray-600">{slides[slideIndex].desc}</p>

            <div className="mb-5 flex justify-center gap-2">
              {slides.map((_, i) => (
                <div
                  key={i}
                  className={`h-2 rounded-full transition-all ${
                    i === slideIndex ? 'w-6 bg-violet-500' : 'w-2 bg-purple-100'
                  }`}
                />
              ))}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSlideIndex((prev) => Math.max(0, prev - 1))}
                disabled={slideIndex === 0}
                className="flex-1 rounded-xl border border-purple-100 py-3 font-bold text-gray-500 disabled:opacity-30"
              >
                이전
              </button>

              {slideIndex < slides.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setSlideIndex((prev) => prev + 1)}
                  className="flex-1 rounded-xl bg-violet-500 py-3 font-bold text-white shadow-md shadow-violet-200"
                >
                  다음
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowGuidePopup(false)}
                  className="flex-1 rounded-xl bg-violet-500 py-3 font-bold text-white shadow-md shadow-violet-200"
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
          <h1 className="text-2xl font-black text-purple-950 dark:text-purple-950">포토 키캡키링</h1>
          <p className="mt-1 text-sm text-purple-600/70 dark:text-purple-600/70">
            마음에 드는 사이즈를 선택하고 사진을 가이드에 맞춰주세요.
          </p>
        </header>

        <section className="rounded-3xl bg-white dark:bg-white p-4 shadow-sm border border-purple-100/50">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-gray-900 dark:text-gray-900">사이즈 선택</h2>
            <span className="rounded-full bg-violet-50 dark:bg-violet-50 px-3 py-1 text-xs font-bold text-violet-600 dark:text-violet-600">
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
                    ? 'border-violet-500 bg-violet-50/50 text-violet-600 dark:text-violet-600 shadow-sm'
                    : 'border-purple-50 bg-white dark:bg-white text-gray-700 dark:text-gray-700 hover:border-purple-200'
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

        <section className="rounded-3xl bg-white dark:bg-white p-4 shadow-sm border border-purple-100/50">
          <div className="relative w-full overflow-hidden rounded-2xl border border-purple-100 bg-purple-50/20 dark:bg-purple-50/20">
            {!hasImage && (
              <div 
                onClick={triggerFileInput}
                className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-purple-50/90 dark:bg-purple-50/90 cursor-pointer p-6 text-center hover:bg-purple-100/70 transition-all gap-2"
              >
                <div className="w-12 h-12 rounded-full bg-white dark:bg-white flex items-center justify-center text-violet-500 shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </div>
                <span className="text-base font-bold text-purple-950 dark:text-purple-950">클릭하여 사진 첨부하기</span>
                <span className="text-xs text-purple-600/70 dark:text-purple-600/70">스마트폰 앨범 또는 PC 보관함에서 사진을 선택해 주세요.</span>
              </div>
            )}

            <div ref={containerRef} className="w-full" style={{ touchAction: 'pan-y' }}>
              <canvas ref={canvasRef} />
            </div>
          </div>

          <p className="mt-3 text-center text-xs leading-5 text-gray-500 dark:text-gray-500">
            빨간색 박스는 실제 각인되는 키캡 전체 면적입니다.<br />
            격자무늬는 실제 키캡간의 경계라인입니다.            
          </p>

          <div className="mt-4 flex flex-col gap-2">
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => zoomImage(1.1)}
                className="rounded-xl bg-purple-50/60 dark:bg-purple-50/60 py-3 text-xs font-bold text-purple-950 dark:text-purple-950 hover:bg-purple-100/50 disabled:opacity-40"
                disabled={!hasImage}
              >
                확대
              </button>
              <button
                type="button"
                onClick={() => zoomImage(0.9)}
                className="rounded-xl bg-purple-50/60 dark:bg-purple-50/60 py-3 text-xs font-bold text-purple-950 dark:text-purple-950 hover:bg-purple-100/50 disabled:opacity-40"
                disabled={!hasImage}
              >
                축소
              </button>
              <button
                type="button"
                onClick={centerImage}
                className="rounded-xl bg-purple-50/60 dark:bg-purple-50/60 py-3 text-xs font-bold text-purple-950 dark:text-purple-950 hover:bg-purple-100/50 disabled:opacity-40"
                disabled={!hasImage}
              >
                가운데
              </button>
              <button
                type="button"
                onClick={resetImage}
                className="rounded-xl bg-purple-50/60 dark:bg-purple-50/60 py-3 text-xs font-bold text-purple-950 dark:text-purple-950 hover:bg-purple-100/50 disabled:opacity-40"
                disabled={!hasImage}
              >
                초기화
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={rotateImage90}
                className="rounded-xl bg-violet-50 dark:bg-violet-50 py-3 text-xs font-bold text-violet-700 hover:bg-purple-100/60 disabled:opacity-40 flex items-center justify-center gap-1 border border-purple-100"
                disabled={!hasImage}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                90° 회전
              </button>
              <button
                type="button"
                onClick={flipImageX}
                className="rounded-xl bg-violet-50 dark:bg-violet-50 py-3 text-xs font-bold text-violet-700 hover:bg-purple-100/60 disabled:opacity-40 flex items-center justify-center gap-1 border border-purple-100"
                disabled={!hasImage}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0-4.5 4.5M21 7.5H7.5" />
                </svg>
                좌우 대칭
              </button>
              <button
                type="button"
                onClick={flipImageY}
                className="rounded-xl bg-violet-50 dark:bg-violet-50 py-3 text-xs font-bold text-violet-700 hover:bg-purple-100/60 disabled:opacity-40 flex items-center justify-center gap-1 border border-purple-100"
                disabled={!hasImage}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0-4.5 4.5m0 0-4.5-4.5m4.5 4.5V7.5" />
                </svg>
                상하 대칭
              </button>
            </div>
          </div>

          {hasImage && (
            <button
              type="button"
              onClick={triggerFileInput}
              className="w-full mt-2 rounded-xl border border-dashed border-purple-200 bg-white dark:bg-white py-2.5 text-xs font-bold text-violet-600 dark:text-violet-600 hover:bg-purple-50/30 flex items-center justify-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              다른 사진으로 변경하기
            </button>
          )}
        </section>

        <button
          type="button"
          onClick={handleDesignComplete}
          className="rounded-2xl bg-violet-500 py-4 text-lg font-black text-white shadow-lg shadow-violet-100 transition active:scale-95 disabled:bg-purple-200 disabled:scale-100 disabled:shadow-none"
          disabled={!hasImage}
        >
          {showOrderForm ? '✔️ 편집 정보가 반영되었습니다' : '편집 완료'}
        </button>

        {showOrderForm && (
          <div 
            ref={orderFormRef} 
            className="border-t border-purple-100 pt-8 space-y-8 transition-all duration-500 animate-fadeIn"
          >
            <div className="grid grid-cols-1 gap-8">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-purple-950 dark:text-purple-950">주문자 정보 입력</h3>
                
                <form onSubmit={handleOrderSubmit} className="space-y-4 bg-white dark:bg-white p-6 rounded-xl border border-purple-100/60 shadow-sm text-gray-900 dark:text-gray-900">
                  
                  <div>
                    <label htmlFor="customerName" className="block text-sm font-medium text-gray-700 dark:text-gray-700 mb-1">
                      주문자 성함
                    </label>
                    <input
                      type="text"
                      id="customerName"
                      required
                      value={orderData.customerName}
                      onChange={handleNameChange}
                      placeholder="홍길동"
                      className="w-full px-3 py-2 border border-purple-100 rounded-md focus:outline-none focus:ring-1 focus:ring-violet-400 focus:border-violet-400 text-sm bg-white dark:bg-white text-gray-900 dark:text-gray-900 placeholder-gray-400"
                    />
                  </div>

                  <div>
                    <label htmlFor="contact" className="block text-sm font-medium text-gray-700 dark:text-gray-700 mb-1">
                      주문자 연락처
                    </label>
                    <input
                      type="tel"
                      id="contact"
                      required
                      value={orderData.contact}
                      onChange={handleContactChange}
                      placeholder="01012345678 -없이 입력"
                      className="w-full px-3 py-2 border border-purple-100 rounded-md focus:outline-none focus:ring-1 focus:ring-violet-400 focus:border-violet-400 text-sm bg-white dark:bg-white text-gray-900 dark:text-gray-900 placeholder-gray-400"
                    />
                  </div>

                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-700">
                        보드 색상
                      </label>

                      <span className="text-xs font-medium text-violet-500">
                        선택: {orderData.boardColor}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {[
                        ...BOARD_COLORS,
                        ...(selectedSize === '3x3'
                          ? [
                              {
                                name: '투명',
                                hex: 'transparent',
                              },
                            ]
                          : []),
                      ].map((color) => {
                        const isSelected = orderData.boardColor === color.name;
                        const isTransparent = color.name === '투명';

                        return (
                          <label
                            key={color.name}
                            className={`
                              relative flex cursor-pointer flex-col items-center justify-center
                              gap-2 rounded-xl border px-2 py-3 transition-all
                              ${
                                isSelected
                                  ? 'border-violet-500 bg-violet-50 shadow-sm ring-1 ring-violet-400'
                                  : 'border-purple-100 bg-white hover:border-violet-300 hover:bg-purple-50/30'
                              }
                            `}
                          >
                            <input
                              type="radio"
                              name="boardColor"
                              value={color.name}
                              checked={isSelected}
                              onChange={(e) =>
                                setOrderData((prev) => ({
                                  ...prev,
                                  boardColor: e.target.value,
                                }))
                              }
                              className="sr-only"
                            />

                            <span
                              className={`
                                relative flex h-8 w-8 items-center justify-center
                                overflow-hidden rounded-full border shadow-sm
                                ${
                                  color.name === '화이트'
                                    ? 'border-gray-300'
                                    : 'border-black/10'
                                }
                              `}
                              style={
                                isTransparent
                                  ? {
                                      backgroundImage:
                                        'linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)',
                                      backgroundSize: '10px 10px',
                                      backgroundPosition:
                                        '0 0, 0 5px, 5px -5px, -5px 0px',
                                      backgroundColor: '#ffffff',
                                    }
                                  : {
                                      backgroundColor: color.hex,
                                    }
                              }
                            >
                              {isSelected && (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 20 20"
                                  fill="none"
                                  stroke={
                                    color.name === '화이트' ||
                                    color.name === '옐로우' ||
                                    isTransparent
                                      ? '#7c3aed'
                                      : '#ffffff'
                                  }
                                  strokeWidth="2.5"
                                  className="h-4 w-4"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M4 10.5 8 14l8-8"
                                  />
                                </svg>
                              )}
                            </span>

                            <span
                              className={`text-xs font-semibold ${
                                isSelected ? 'text-violet-700' : 'text-gray-700'
                              }`}
                            >
                              {color.name}
                            </span>
                          </label>
                        );
                      })}
                    </div>

                    <p className="mt-2 text-xs leading-5 text-gray-400">
                      실제 제품 색상은 화면 설정과 조명에 따라 조금 다르게 보일 수 있습니다.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="eventCode" className="block text-sm font-medium text-gray-700 dark:text-gray-700 mb-1">
                      이벤트 코드 <span className="text-xs text-purple-400 font-normal">(선택사항 / 최대 8자)</span>
                    </label>
                    <input
                      type="text"
                      id="eventCode"
                      value={orderData.eventCode}
                      onChange={handleEventCodeChange}
                      placeholder="이벤트 코드를 입력해주세요"
                      className="w-full px-3 py-2 border border-purple-100 rounded-md focus:outline-none focus:ring-1 focus:ring-violet-400 focus:border-violet-400 text-sm bg-white dark:bg-white text-gray-900 dark:text-gray-900 placeholder-gray-400"
                    />
                  </div>

                  <div className="pt-4">
                    <button
                      type="submit"
                      className="w-full py-3 bg-violet-500 text-white font-semibold rounded-lg shadow-md shadow-violet-100 hover:bg-violet-600 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2"
                    >
                      주문 제작 신청하기
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {submittedOrder && (
          <section
            ref={orderCompleteRef}
            className="scroll-mt-6 overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-lg shadow-emerald-100/50"
          >
            <div className="bg-gradient-to-br from-emerald-50 to-white px-5 py-7 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-2xl font-black text-white shadow-md shadow-emerald-200">
                ✓
              </div>

              <h2 className="mt-4 text-2xl font-black text-gray-950">
                시안 접수가 완료되었습니다
              </h2>

              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-gray-600">
                작성하신 시안이 정상적으로 저장되었습니다. 아래 옵션을 확인한 뒤
                스마트스토어에서 주문을 완료해 주세요.
              </p>
            </div>

            <div className="space-y-5 p-5">
              <div className="overflow-hidden rounded-2xl border border-purple-100 bg-gray-50 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={submittedOrder.previewImageUrl}
                  alt="접수한 포토 키캡 시안"
                  className="mx-auto max-h-[320px] w-auto max-w-full object-contain"
                />
              </div>

              <div className="rounded-2xl border border-purple-100 bg-[#fcfbff] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black text-violet-500">선택한 시안 옵션</p>
                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      스마트스토어에서도 아래와 동일하게 선택해 주세요.
                    </p>
                  </div>

                  <span className="shrink-0 rounded-full bg-violet-100 px-3 py-1 text-[11px] font-black text-violet-700">
                    확인 필수
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-purple-100 bg-white p-4">
                    <p className="text-[11px] font-bold text-gray-400">사이즈</p>
                    <p className="mt-1 text-base font-black text-purple-950">
                      {submittedOrder.size}
                    </p>
                  </div>

                  <div className="rounded-xl border border-purple-100 bg-white p-4">
                    <p className="text-[11px] font-bold text-gray-400">보드 색상</p>
                    <p className="mt-1 text-base font-black text-purple-950">
                      {submittedOrder.boardColor}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
                <p className="text-sm font-black text-blue-950">주문 안내</p>
                <p className="mt-2 text-sm leading-6 text-blue-900">
                  아래 버튼을 눌러 스마트스토어로 이동한 뒤, 방금 접수한 시안과
                  동일한 <strong className="font-black">사이즈와 보드 색상</strong>을
                  선택해 주문해 주세요.
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-400 text-sm font-black text-white">
                    !
                  </span>

                  <div>
                    <p className="text-sm font-black text-amber-950">
                      주문 전 반드시 확인해 주세요
                    </p>
                    <p className="mt-1 text-xs leading-5 text-amber-900">
                      실제 제작은 시안 접수 시 선택한 옵션이 아니라
                      <strong className="font-black"> 스마트스토어에서 최종 선택한 옵션</strong>을
                      기준으로 진행됩니다.
                    </p>
                    <p className="mt-2 text-xs leading-5 text-amber-900">
                      시안과 다른 옵션을 선택하면 스마트스토어 주문 옵션대로 제작되므로,
                      결제 전에 사이즈와 색상을 다시 한번 확인해 주세요.
                    </p>
                  </div>
                </div>
              </div>

              <a
                href={SMART_STORE_PRODUCT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#03C75A] px-4 py-4 text-base font-black text-white shadow-lg shadow-emerald-100 transition hover:bg-[#02b351] active:scale-[0.99]"
              >
                <span aria-hidden="true">🛒</span>
                스마트스토어에서 주문 완료하기
              </a>

              <p className="text-center text-[11px] leading-5 text-gray-400">
                버튼을 누르면 스마트스토어 상품 페이지가 새 창으로 열립니다.
              </p>

              <button
                type="button"
                onClick={() => {
                  setSubmittedOrder(null);
                  setPreviewImageUrl(null);
                  setShowOrderForm(false);
                  setOrderData({
                    orderType: '주문전',
                    customerName: '',
                    contact: '',
                    boardColor: '블랙',
                    eventCode: '',
                  });
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full rounded-xl border border-purple-100 bg-white py-3 text-sm font-bold text-gray-500 transition hover:bg-purple-50 hover:text-purple-800"
              >
                새로운 시안 만들기
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
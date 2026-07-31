'use client';

import * as fabric from 'fabric';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const UNIT_PIXELS = 250;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_IMAGES = 20;
const GAP_MM = 0.3;
const KEYCAP_MM = 18.6;

const LAYOUTS = [
  { key: '1x4', rows: 1, cols: 4, label: '가로 4키' },
  { key: '1x3', rows: 1, cols: 3, label: '가로 3키' },
  { key: '2x3', rows: 2, cols: 3, label: '2행 3열' },
  { key: '3x3', rows: 3, cols: 3, label: '3행 3열' },
] as const;

type LayoutKey = (typeof LAYOUTS)[number]['key'];

type KeycapColorKey = 'white' | 'black' | 'gray' | 'navy' | 'ivory';

const KEYCAP_COLORS: Array<{
  key: KeycapColorKey;
  label: string;
  hex: string;
  text: string;
}> = [
  { key: 'white', label: '화이트', hex: '#F7F7F4', text: '#111827' },
  { key: 'black', label: '블랙', hex: '#222326', text: '#FFFFFF' },
  { key: 'gray', label: '그레이', hex: '#9A9CA1', text: '#111827' },
  { key: 'navy', label: '네이비', hex: '#26344A', text: '#FFFFFF' },
  { key: 'ivory', label: '아이보리', hex: '#EDE5D3', text: '#111827' },
];

const FONT_OPTIONS = [
  { key: 'Pretendard', label: '고딕체', sample: '깔끔한 고딕', weight: 100 },
  { key: 'MitmiFont', label: '둥근체', sample: '말랑한 둥근체', weight: 400 },
  { key: 'BinggreIi', label: '개성체', sample: '개성있는 글씨', weight: 700 },
] as const;

type GuideBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
  cellWidth: number;
  cellHeight: number;
  gapPx: number;
};

type OrderData = {
  orderType: '주문전' | '주문완료';
  customerName: string;
  contact: string;
  orderNumber: string;
  requestMessage: string;
  eventCode: string;
  privacyAgreed: boolean;
};

type HistorySnapshot = {
  json: Record<string, unknown>;
};

type GuideObject = fabric.FabricObject & {
  isGuide?: boolean;
  guideLayer?: 'background' | 'overlay';
};

const isGuideObject = (obj: fabric.FabricObject) => Boolean((obj as GuideObject).isGuide);

const isBackgroundGuide = (obj: fabric.FabricObject) =>
  isGuideObject(obj) && (obj as GuideObject).guideLayer === 'background';

const markAsGuideObject = (
  obj: fabric.FabricObject,
  guideLayer: 'background' | 'overlay' = 'overlay',
) => {
  const guide = obj as GuideObject;
  guide.isGuide = true;
  guide.guideLayer = guideLayer;
};

const isDesignObject = (obj: fabric.FabricObject) => !isGuideObject(obj);

const createSelectiveRoundedRectPath = (
  width: number,
  height: number,
  radii: { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number },
) => {
  const tl = Math.max(0, Math.min(radii.topLeft, width / 2, height / 2));
  const tr = Math.max(0, Math.min(radii.topRight, width / 2, height / 2));
  const br = Math.max(0, Math.min(radii.bottomRight, width / 2, height / 2));
  const bl = Math.max(0, Math.min(radii.bottomLeft, width / 2, height / 2));

  return [
    `M ${tl} 0`,
    `H ${width - tr}`,
    tr > 0 ? `Q ${width} 0 ${width} ${tr}` : `L ${width} 0`,
    `V ${height - br}`,
    br > 0 ? `Q ${width} ${height} ${width - br} ${height}` : `L ${width} ${height}`,
    `H ${bl}`,
    bl > 0 ? `Q 0 ${height} 0 ${height - bl}` : `L 0 ${height}`,
    `V ${tl}`,
    tl > 0 ? `Q 0 0 ${tl} 0` : 'L 0 0',
    'Z',
  ].join(' ');
};

const getObjectKind = (obj: fabric.FabricObject | null | undefined) => {
  if (!obj) return null;
  if (obj instanceof fabric.IText || obj instanceof fabric.Textbox || obj instanceof fabric.Text) {
    return 'text';
  }
  if (obj instanceof fabric.FabricImage) return 'image';
  return 'other';
};

export default function KeycapCustomEditorPage() {
  const canvasElementRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const orderFormRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<fabric.Canvas | null>(null);
  const guideBoundsRef = useRef<GuideBounds>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    cellWidth: 0,
    cellHeight: 0,
    gapPx: 0,
  });

  const historyRef = useRef<HistorySnapshot[]>([]);
  const historyIndexRef = useRef(-1);
  const restoringHistoryRef = useRef(false);
  const historyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedLayout, setSelectedLayout] = useState<LayoutKey>('1x4');
  const [selectedColor, setSelectedColor] = useState<KeycapColorKey>('white');
  const [selectedObjectKind, setSelectedObjectKind] = useState<'image' | 'text' | 'other' | null>(null);
  const [designObjectCount, setDesignObjectCount] = useState(0);
  const [imageCount, setImageCount] = useState(0);
  const [opacity, setOpacity] = useState(100);
  const [textValue, setTextValue] = useState('');
  const [fontFamily, setFontFamily] = useState('Pretendard');
  const [textColor, setTextColor] = useState('#111111');
  const [fontSize, setFontSize] = useState(42);
  const [fontWeight, setFontWeight] = useState(400);
  const [letterSpacing, setLetterSpacing] = useState(0);
  const [textAngle, setTextAngle] = useState(0);
  const [isAddingText, setIsAddingText] = useState(false);
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isConvertingHeic, setIsConvertingHeic] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [orderData, setOrderData] = useState<OrderData>({
    orderType: '주문전',
    customerName: '',
    contact: '',
    orderNumber: '',
    requestMessage: '',
    eventCode: '',
    privacyAgreed: false,
  });

  const selectedSpec = useMemo(
    () => LAYOUTS.find((layout) => layout.key === selectedLayout) ?? LAYOUTS[0],
    [selectedLayout],
  );

  const selectedColorSpec = useMemo(
    () => KEYCAP_COLORS.find((color) => color.key === selectedColor) ?? KEYCAP_COLORS[0],
    [selectedColor],
  );

  const updateObjectCounts = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const designObjects = canvas.getObjects().filter(isDesignObject);
    setDesignObjectCount(designObjects.length);
    setImageCount(designObjects.filter((obj) => obj instanceof fabric.FabricImage).length);
  }, []);

  const clearGuides = useCallback((canvas: fabric.Canvas) => {
    canvas.getObjects().forEach((obj) => {
      if (isGuideObject(obj)) canvas.remove(obj);
    });
  }, []);

  const arrangeGuideLayers = useCallback((canvas: fabric.Canvas) => {
    // 키캡 바탕색은 디자인 아래에, 경계선·안전영역·회색 마스크는 디자인 위에 둡니다.
    canvas.getObjects().filter(isBackgroundGuide).forEach((obj) => {
      canvas.sendObjectToBack(obj);
    });

    canvas.getObjects().forEach((obj) => {
      if (isGuideObject(obj) && !isBackgroundGuide(obj)) {
        canvas.bringObjectToFront(obj);
      }
    });
    canvas.requestRenderAll();
  }, []);

  const drawGuides = useCallback(
    (canvas: fabric.Canvas, rows: number, cols: number, colorHex: string) => {
      clearGuides(canvas);

      const canvasWidth = canvas.getWidth();
      const canvasHeight = canvas.getHeight();
      const maxGuideWidth = canvasWidth * 0.88;
      const maxGuideHeight = canvasHeight * 0.68;
      const physicalRatio =
        (cols * KEYCAP_MM + Math.max(0, cols - 1) * GAP_MM) /
        (rows * KEYCAP_MM + Math.max(0, rows - 1) * GAP_MM);

      let guideWidth = maxGuideWidth;
      let guideHeight = guideWidth / physicalRatio;
      if (guideHeight > maxGuideHeight) {
        guideHeight = maxGuideHeight;
        guideWidth = guideHeight * physicalRatio;
      }

      const left = Math.round((canvasWidth - guideWidth) / 2);
      const top = Math.round((canvasHeight - guideHeight) / 2);
      const mmToPx = guideWidth / (cols * KEYCAP_MM + Math.max(0, cols - 1) * GAP_MM);
      const gapPx = GAP_MM * mmToPx;
      const cellWidth = (guideWidth - Math.max(0, cols - 1) * gapPx) / cols;
      const cellHeight = (guideHeight - Math.max(0, rows - 1) * gapPx) / rows;

      guideBoundsRef.current = {
        left,
        top,
        width: guideWidth,
        height: guideHeight,
        cellWidth,
        cellHeight,
        gapPx,
      };

      // 키캡별 실제 면과 사이 간격
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const cellLeft = left + col * (cellWidth + gapPx);
          const cellTop = top + row * (cellHeight + gapPx);

          // 배열의 바깥쪽 네 꼭짓점에 해당하는 키캡만 해당 모서리를 둥글게 처리합니다.
          const cornerRadius = Math.max(7, Math.min(cellWidth, cellHeight) * 0.09);
          const keycapPath = createSelectiveRoundedRectPath(cellWidth, cellHeight, {
            topLeft: row === 0 && col === 0 ? cornerRadius : 0,
            topRight: row === 0 && col === cols - 1 ? cornerRadius : 0,
            bottomRight: row === rows - 1 && col === cols - 1 ? cornerRadius : 0,
            bottomLeft: row === rows - 1 && col === 0 ? cornerRadius : 0,
          });

          const keycap = new fabric.Path(keycapPath, {
            left: cellLeft,
            top: cellTop,
            originX: 'left',
            originY: 'top',
            fill: colorHex,
            stroke: 'rgba(17,24,39,0.55)',
            strokeWidth: 1.2,
            strokeUniform: true,
            selectable: false,
            evented: false,
            excludeFromExport: true,
          });
          markAsGuideObject(keycap, 'background');
          canvas.add(keycap);

          const safeArea = new fabric.Rect({
            left: cellLeft + cellWidth * 0.055,
            top: cellTop + cellHeight * 0.055,
            width: cellWidth * 0.89,
            height: cellHeight * 0.89,
            originX: 'left',
            originY: 'top',
            fill: 'transparent',
            stroke: 'rgba(239,68,68,0.7)',
            strokeWidth: 1,
            strokeDashArray: [5, 4],
            strokeUniform: true,
            selectable: false,
            evented: false,
            excludeFromExport: true,
          });
          markAsGuideObject(safeArea);
          canvas.add(safeArea);
        }
      }

      const outerBorder = new fabric.Rect({
        left,
        top,
        width: guideWidth,
        height: guideHeight,
        originX: 'left',
        originY: 'top',
        fill: 'transparent',
        rx: Math.max(7, Math.min(cellWidth, cellHeight) * 0.09),
        ry: Math.max(7, Math.min(cellWidth, cellHeight) * 0.09),
        stroke: '#7C3AED',
        strokeWidth: 2,
        strokeUniform: true,
        selectable: false,
        evented: false,
        excludeFromExport: true,
      });
      markAsGuideObject(outerBorder);
      canvas.add(outerBorder);

      const centerX = left + guideWidth / 2;
      const centerY = top + guideHeight / 2;
      const verticalCenter = new fabric.Line([centerX, top, centerX, top + guideHeight], {
        stroke: '#7C3AED',
        strokeWidth: 1,
        opacity: 0.45,
        strokeDashArray: [4, 4],
        selectable: false,
        evented: false,
        excludeFromExport: true,
      });
      const horizontalCenter = new fabric.Line([left, centerY, left + guideWidth, centerY], {
        stroke: '#7C3AED',
        strokeWidth: 1,
        opacity: 0.45,
        strokeDashArray: [4, 4],
        selectable: false,
        evented: false,
        excludeFromExport: true,
      });
      markAsGuideObject(verticalCenter);
      markAsGuideObject(horizontalCenter);
      canvas.add(verticalCenter, horizontalCenter);
      arrangeGuideLayers(canvas);
    },
    [arrangeGuideLayers, clearGuides],
  );

  const getDesignJSON = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return { version: '0', objects: [] };
    const objects = canvas.getObjects().filter(isDesignObject);
    return {
      version: fabric.version,
      objects: objects.map((obj) => obj.toObject()),
    };
  }, []);

  const refreshHistoryButtons = useCallback(() => {
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  }, []);

  const pushHistory = useCallback(() => {
    if (restoringHistoryRef.current) return;
    const snapshot: HistorySnapshot = { json: getDesignJSON() as Record<string, unknown> };
    const nextHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    nextHistory.push(snapshot);
    if (nextHistory.length > 40) nextHistory.shift();
    historyRef.current = nextHistory;
    historyIndexRef.current = nextHistory.length - 1;
    refreshHistoryButtons();
  }, [getDesignJSON, refreshHistoryButtons]);

  const scheduleHistory = useCallback(() => {
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    historyTimerRef.current = setTimeout(() => pushHistory(), 180);
  }, [pushHistory]);

  const invalidatePreview = useCallback(() => {
    setShowOrderForm(false);
    setPreviewImageUrl(null);
  }, []);

  const syncSelectionState = useCallback((obj: fabric.FabricObject | null | undefined) => {
    const kind = getObjectKind(obj);
    setSelectedObjectKind(kind);
    if (!obj) return;
    setOpacity(Math.round((obj.opacity ?? 1) * 100));
    if (kind === 'text') {
      const textObject = obj as fabric.IText;
      setTextValue(textObject.text ?? '');
      setFontFamily(textObject.fontFamily ?? 'Pretendard');
      setTextColor(typeof textObject.fill === 'string' ? textObject.fill : '#111111');
      setFontSize(Math.round(textObject.fontSize ?? 42));
      setFontWeight(Number(textObject.fontWeight) || 400);
      setLetterSpacing(Math.round(textObject.charSpacing ?? 0));
      setTextAngle(Math.round(textObject.angle ?? 0));
      setIsAddingText(false);
      setShowTextEditor(true);
    }
  }, []);

  const restoreHistoryAt = useCallback(
    async (index: number) => {
      const canvas = canvasRef.current;
      const snapshot = historyRef.current[index];
      if (!canvas || !snapshot) return;

      restoringHistoryRef.current = true;
      canvas.discardActiveObject();
      canvas.getObjects().filter(isDesignObject).forEach((obj) => canvas.remove(obj));

      const enlivened = await fabric.util.enlivenObjects<fabric.FabricObject>(
        (snapshot.json.objects as object[]) ?? [],
      );
      enlivened.forEach((obj) => canvas.add(obj));
      arrangeGuideLayers(canvas);
      canvas.requestRenderAll();
      historyIndexRef.current = index;
      restoringHistoryRef.current = false;
      refreshHistoryButtons();
      updateObjectCounts();
      syncSelectionState(null);
      invalidatePreview();
    },
    [arrangeGuideLayers, invalidatePreview, refreshHistoryButtons, syncSelectionState, updateObjectCounts],
  );

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    void restoreHistoryAt(historyIndexRef.current - 1);
  }, [restoreHistoryAt]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    void restoreHistoryAt(historyIndexRef.current + 1);
  }, [restoreHistoryAt]);

  const resetHistory = useCallback(() => {
    historyRef.current = [];
    historyIndexRef.current = -1;
    pushHistory();
  }, [pushHistory]);

  const updateCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = canvasContainerRef.current;
    if (!canvas || !container) return;
    const width = Math.max(280, Math.floor(container.clientWidth));
    const height = Math.max(360, Math.min(520, Math.round(width * 0.92)));
    canvas.setDimensions({ width, height });
    drawGuides(canvas, selectedSpec.rows, selectedSpec.cols, selectedColorSpec.hex);
  }, [drawGuides, selectedColorSpec.hex, selectedSpec.cols, selectedSpec.rows]);

  useEffect(() => {
    if (!canvasElementRef.current || !canvasContainerRef.current) return;

    const width = Math.max(280, canvasContainerRef.current.clientWidth);
    const canvas = new fabric.Canvas(canvasElementRef.current, {
      width,
      height: Math.max(360, Math.min(520, Math.round(width * 0.92))),
      backgroundColor: '#F8F7FB',
      preserveObjectStacking: true,
      selection: true,
      allowTouchScrolling: true,
      targetFindTolerance: 16,
      controlsAboveOverlay: true,
    });
    canvasRef.current = canvas;

    drawGuides(canvas, selectedSpec.rows, selectedSpec.cols, selectedColorSpec.hex);

    const onSelection = () => {
      const active = canvas.getActiveObject();
      if (active && !isGuideObject(active)) {
        // 작은 요소도 모바일에서 쉽게 잡고 이동할 수 있도록 선택 여백과 조절점을 확대합니다.
        active.set({
          padding: Math.max(active.padding ?? 0, 12),
          cornerSize: Math.max(active.cornerSize ?? 0, 18),
          transparentCorners: false,
          borderScaleFactor: 2,
        });
        active.setCoords();
        canvas.requestRenderAll();
      }
      syncSelectionState(active);
    };
    const onSelectionCleared = () => {
      syncSelectionState(null);
    };
    const onObjectChanged = () => {
      invalidatePreview();
      updateObjectCounts();
      scheduleHistory();
      arrangeGuideLayers(canvas);
    };

    canvas.on('selection:created', onSelection);
    canvas.on('selection:updated', onSelection);
    canvas.on('selection:cleared', onSelectionCleared);
    canvas.on('object:modified', onObjectChanged);
    canvas.on('object:added', onObjectChanged);
    canvas.on('object:removed', onObjectChanged);

    // 객체를 터치할 때만 캔버스 제스처를 잡고, 빈 영역에서는 세로 스크롤 허용
    const upperCanvas = canvas.upperCanvasEl;
    const onTouchStart = (event: TouchEvent) => {
      const target = canvas.findTarget(event)?.target;
      upperCanvas.style.touchAction = target && !isGuideObject(target) ? 'none' : 'pan-y';
    };
    const onTouchEnd = () => {
      upperCanvas.style.touchAction = 'pan-y';
    };
    upperCanvas.addEventListener('touchstart', onTouchStart, { passive: true });
    upperCanvas.addEventListener('touchend', onTouchEnd, { passive: true });
    upperCanvas.addEventListener('touchcancel', onTouchEnd, { passive: true });

    const resizeObserver = new ResizeObserver(() => updateCanvasSize());
    resizeObserver.observe(canvasContainerRef.current);

    resetHistory();

    return () => {
      if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
      resizeObserver.disconnect();
      upperCanvas.removeEventListener('touchstart', onTouchStart);
      upperCanvas.removeEventListener('touchend', onTouchEnd);
      upperCanvas.removeEventListener('touchcancel', onTouchEnd);
      canvas.dispose();
      canvasRef.current = null;
    };
    // 초기 마운트에서만 Fabric 인스턴스 생성
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawGuides(canvas, selectedSpec.rows, selectedSpec.cols, selectedColorSpec.hex);
    canvas.requestRenderAll();
  }, [drawGuides, selectedColorSpec.hex, selectedSpec.cols, selectedSpec.rows]);

  const clearAllDesignObjects = useCallback(
    (withHistory = true) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.discardActiveObject();
      canvas.getObjects().filter(isDesignObject).forEach((obj) => canvas.remove(obj));
      arrangeGuideLayers(canvas);
      updateObjectCounts();
      syncSelectionState(null);
      invalidatePreview();
      if (withHistory) resetHistory();
    },
    [arrangeGuideLayers, invalidatePreview, resetHistory, syncSelectionState, updateObjectCounts],
  );

  const requestLayoutChange = (nextLayout: LayoutKey) => {
    if (nextLayout === selectedLayout) return;
    if (designObjectCount > 0) {
      const confirmed = window.confirm(
        '배열을 변경하면 현재 편집 중인 이미지와 텍스트가 모두 초기화됩니다. 배열을 변경할까요?',
      );
      if (!confirmed) return;
      clearAllDesignObjects(false);
    }
    setSelectedLayout(nextLayout);
    setTimeout(() => resetHistory(), 0);
  };

  const convertHeicIfNeeded = async (file: File): Promise<Blob> => {
    const isHeic = /\.(heic|heif)$/i.test(file.name) || /image\/(heic|heif)/i.test(file.type);
    if (!isHeic) return file;

    setIsConvertingHeic(true);
    try {
      const { default: heic2any } = await import('heic2any');
      const result = await heic2any({ blob: file, toType: 'image/png', quality: 1 });
      return Array.isArray(result) ? result[0] : result;
    } finally {
      setIsConvertingHeic(false);
    }
  };

  const addImageBlob = async (blob: Blob, name: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const objectUrl = URL.createObjectURL(blob);
    try {
      const image = await fabric.FabricImage.fromURL(objectUrl, { crossOrigin: 'anonymous' });
      const bounds = guideBoundsRef.current;
      const activeImageIndex = canvas.getObjects().filter((obj) => obj instanceof fabric.FabricImage).length;
      image.set({
        left: bounds.left + bounds.width / 2 + (activeImageIndex % 4) * 8,
        top: bounds.top + bounds.height / 2 + (activeImageIndex % 4) * 8,
        originX: 'center',
        originY: 'center',
        cornerStyle: 'circle',
        transparentCorners: false,
        borderColor: '#7C3AED',
        cornerColor: '#7C3AED',
        cornerStrokeColor: '#FFFFFF',
        cornerSize: 18,
        padding: 12,
        lockUniScaling: true,
        objectCaching: false,
        name,
      });

      const targetWidth = Math.min(bounds.width * 0.7, bounds.cellWidth * 1.25);
      image.scaleToWidth(targetWidth);
      canvas.add(image);
      canvas.setActiveObject(image);
      arrangeGuideLayers(canvas);
      canvas.requestRenderAll();
      syncSelectionState(image);
      updateObjectCounts();
      invalidatePreview();
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!files.length) return;

    if (imageCount + files.length > MAX_IMAGES) {
      alert(`이미지는 최대 ${MAX_IMAGES}장까지 추가할 수 있습니다.`);
      return;
    }

    const allowedExtension = /\.(jpe?g|png|webp|heic|heif)$/i;
    for (const file of files) {
      if (!allowedExtension.test(file.name)) {
        alert(`${file.name}: JPG, JPEG, PNG, WEBP, HEIC 파일만 업로드할 수 있습니다.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        alert(`${file.name}: 파일 크기는 10MB 이하여야 합니다.`);
        continue;
      }
      try {
        const converted = await convertHeicIfNeeded(file);
        await addImageBlob(converted, file.name);
      } catch (error) {
        console.error(error);
        alert(`${file.name} 파일을 불러오지 못했습니다.`);
      }
    }
  };

  const addText = () => {
    const canvas = canvasRef.current;
    const value = textValue.trim();
    if (!canvas || !value) {
      alert('추가할 문구를 입력해 주세요.');
      return;
    }

    const bounds = guideBoundsRef.current;
    void document.fonts.load(`${fontWeight} ${fontSize}px \"${fontFamily}\"`).then(() => {
      const text = new fabric.IText(value, {
      left: bounds.left + bounds.width / 2,
      top: bounds.top + bounds.height / 2,
      originX: 'center',
      originY: 'center',
      fontFamily,
      fontSize,
      fontWeight,
      charSpacing: letterSpacing,
      fill: textColor,
      angle: textAngle,
      cornerStyle: 'circle',
      transparentCorners: false,
      borderColor: '#7C3AED',
      cornerColor: '#7C3AED',
      cornerStrokeColor: '#FFFFFF',
      cornerSize: 18,
      padding: 12,
      lockUniScaling: true,
    });
      canvas.add(text);
      canvas.setActiveObject(text);
      arrangeGuideLayers(canvas);
      canvas.requestRenderAll();
      syncSelectionState(text);
      setIsAddingText(false);
      invalidatePreview();
    });
  };

  const updateActiveObject = (updates: Partial<fabric.FabricObject>) => {
    const canvas = canvasRef.current;
    const active = canvas?.getActiveObject();
    if (!canvas || !active || isGuideObject(active)) return;
    active.set(updates);
    active.setCoords();
    canvas.requestRenderAll();
    arrangeGuideLayers(canvas);
    invalidatePreview();
    scheduleHistory();
    syncSelectionState(active);
  };

  const updateActiveText = (updates: Partial<fabric.IText>) => {
    const canvas = canvasRef.current;
    const active = canvas?.getActiveObject();
    if (!canvas || !(active instanceof fabric.IText)) return;
    active.set(updates);
    active.setCoords();
    canvas.requestRenderAll();
    arrangeGuideLayers(canvas);
    invalidatePreview();
    scheduleHistory();
    syncSelectionState(active);
  };

  const deleteSelected = () => {
    const canvas = canvasRef.current;
    const active = canvas?.getActiveObject();
    if (!canvas || !active || isGuideObject(active)) return;

    if (active instanceof fabric.ActiveSelection) {
      active.getObjects().forEach((obj) => canvas.remove(obj));
    } else {
      canvas.remove(active);
    }
    canvas.discardActiveObject();
    arrangeGuideLayers(canvas);
    canvas.requestRenderAll();
    syncSelectionState(null);
    updateObjectCounts();
    invalidatePreview();
  };

  const moveLayer = (direction: 'front' | 'back') => {
    const canvas = canvasRef.current;
    const active = canvas?.getActiveObject();
    if (!canvas || !active || isGuideObject(active)) return;
    if (direction === 'front') canvas.bringObjectForward(active);
    else canvas.sendObjectBackwards(active);
    arrangeGuideLayers(canvas);
    canvas.requestRenderAll();
    scheduleHistory();
    invalidatePreview();
  };

  const alignToWhole = (axis: 'both' | 'horizontal' | 'vertical') => {
    const canvas = canvasRef.current;
    const active = canvas?.getActiveObject();
    if (!canvas || !active || isGuideObject(active)) return;
    const bounds = guideBoundsRef.current;
    const next: Partial<fabric.FabricObject> = {};
    if (axis === 'both' || axis === 'horizontal') next.left = bounds.left + bounds.width / 2;
    if (axis === 'both' || axis === 'vertical') next.top = bounds.top + bounds.height / 2;
    active.set({ ...next, originX: 'center', originY: 'center' });
    active.setCoords();
    canvas.requestRenderAll();
    arrangeGuideLayers(canvas);
    scheduleHistory();
    invalidatePreview();
  };

  const alignToNearestCell = () => {
    const canvas = canvasRef.current;
    const active = canvas?.getActiveObject();
    if (!canvas || !active || isGuideObject(active)) return;
    const bounds = guideBoundsRef.current;
    const center = active.getCenterPoint();
    const relativeX = Math.max(0, Math.min(bounds.width - 1, center.x - bounds.left));
    const relativeY = Math.max(0, Math.min(bounds.height - 1, center.y - bounds.top));
    const stepX = bounds.cellWidth + bounds.gapPx;
    const stepY = bounds.cellHeight + bounds.gapPx;
    const col = Math.min(selectedSpec.cols - 1, Math.max(0, Math.floor(relativeX / stepX)));
    const row = Math.min(selectedSpec.rows - 1, Math.max(0, Math.floor(relativeY / stepY)));
    active.set({
      left: bounds.left + col * stepX + bounds.cellWidth / 2,
      top: bounds.top + row * stepY + bounds.cellHeight / 2,
      originX: 'center',
      originY: 'center',
    });
    active.setCoords();
    canvas.requestRenderAll();
    arrangeGuideLayers(canvas);
    scheduleHistory();
    invalidatePreview();
  };

  const exportDesign = () => {
    const canvas = canvasRef.current;
    if (!canvas || designObjectCount === 0) {
      alert('사진이나 텍스트를 먼저 추가해 주세요.');
      return;
    }

    canvas.discardActiveObject();
    const guides = canvas.getObjects().filter(isGuideObject);
    guides.forEach((obj) => obj.set({ visible: false }));

    const bounds = guideBoundsRef.current;
    const targetWidth = selectedSpec.cols * UNIT_PIXELS;
    const targetHeight = selectedSpec.rows * UNIT_PIXELS;
    const multiplier = targetWidth / bounds.width;

    // Fabric crop은 화면 가이드 비율로 추출 후, 최종 규격을 정확히 맞추기 위해 보조 캔버스로 리사이즈
    const cropped = canvas.toCanvasElement(multiplier, {
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
    });

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = targetWidth;
    outputCanvas.height = targetHeight;
    const context = outputCanvas.getContext('2d');
    if (!context) return;
    context.fillStyle = selectedColorSpec.hex;
    context.fillRect(0, 0, targetWidth, targetHeight);
    context.drawImage(cropped, 0, 0, targetWidth, targetHeight);
    const dataUrl = outputCanvas.toDataURL('image/png', 1);

    guides.forEach((obj) => obj.set({ visible: true }));
    arrangeGuideLayers(canvas);
    canvas.requestRenderAll();

    setPreviewImageUrl(dataUrl);
    setShowOrderForm(true);
    setTimeout(() => orderFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleOrderSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const name = orderData.customerName.trim();
    if (!name) return alert('주문자 이름을 입력해 주세요.');
    if (name.length > 15) return alert('이름은 최대 15글자까지 입력할 수 있습니다.');
    if (!/^010\d{8}$/.test(orderData.contact) && !/^050\d{9}$/.test(orderData.contact)) {
      return alert('010 또는 050으로 시작하는 올바른 연락처를 입력해 주세요.');
    }
    if (orderData.eventCode.trim().length > 8) return alert('이벤트 코드는 최대 8자입니다.');
    if (!orderData.privacyAgreed) return alert('개인정보 수집 및 이용에 동의해 주세요.');
    if (!previewImageUrl) return alert('편집 완료 버튼을 다시 눌러 시안을 생성해 주세요.');

    console.log('Supabase 연결 전 테스트 데이터', {
      layout: selectedLayout,
      keycapColor: selectedColor,
      previewImageUrl,
      ...orderData,
    });
    setNotice('테스트 접수가 완료되었습니다. 현재는 서버 전송 없이 브라우저 콘솔에 데이터만 출력됩니다.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const downloadPreview = () => {
    if (!previewImageUrl) return;
    const anchor = document.createElement('a');
    anchor.href = previewImageUrl;
    anchor.download = `keycap-${selectedLayout}-${selectedColor}.png`;
    anchor.click();
  };

  const toolButton =
    'rounded-xl border border-purple-100 bg-white px-3 py-2.5 text-xs font-bold text-purple-950 transition hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-35';

  return (
    <main className="min-h-screen bg-[#faf8ff] px-3 py-5 text-gray-900 sm:px-5 sm:py-8">
      {isConvertingHeic && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4">
          <div className="rounded-3xl bg-white px-7 py-6 text-center shadow-2xl">
            <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
            <p className="font-black text-purple-950">아이폰 사진 변환 중</p>
            <p className="mt-1 text-xs text-gray-500">HEIC 파일을 편집 가능한 이미지로 바꾸고 있습니다.</p>
          </div>
        </div>
      )}

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <header className="rounded-3xl border border-purple-100 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-black tracking-[0.18em] text-violet-500">CUSTOM KEYCAP EDITOR</p>
              <h1 className="mt-2 text-2xl font-black text-purple-950 sm:text-3xl">키캡 주문제작 시안 만들기</h1>
              <p className="mt-2 text-sm leading-6 text-gray-500">
                배열과 키캡 색상을 선택한 뒤 사진과 문구를 자유롭게 배치해 주세요.
              </p>
            </div>
            <div className="rounded-2xl bg-violet-50 px-4 py-3 text-sm font-bold text-violet-700">
              {selectedLayout} · {selectedColorSpec.label} · {designObjectCount}개 요소
            </div>
          </div>
        </header>

        {notice && (
          <div className="flex items-start justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice(null)} className="font-black">×</button>
          </div>
        )}

        <section className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="flex flex-col gap-5">
            <section className="rounded-3xl border border-purple-100 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-violet-500">STEP 1</p>
                  <h2 className="mt-1 text-lg font-black text-purple-950">배열 선택</h2>
                </div>
                <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-600">행 × 열</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {LAYOUTS.map((layout) => (
                  <button
                    type="button"
                    key={layout.key}
                    onClick={() => requestLayoutChange(layout.key)}
                    className={`rounded-2xl border p-3 text-left transition ${
                      selectedLayout === layout.key
                        ? 'border-violet-500 bg-violet-50 shadow-sm'
                        : 'border-purple-100 bg-white hover:border-violet-300'
                    }`}
                  >
                    <div className="flex h-16 items-center justify-center rounded-xl bg-[#f8f7fb]">
                      <div
                        className="grid gap-[2px]"
                        style={{
                          gridTemplateColumns: `repeat(${layout.cols}, 17px)`,
                          gridTemplateRows: `repeat(${layout.rows}, 17px)`,
                        }}
                      >
                        {Array.from({ length: layout.rows * layout.cols }).map((_, index) => (
                          <span
                            key={index}
                            className={`rounded-[3px] border ${
                              selectedLayout === layout.key
                                ? 'border-violet-500 bg-violet-400'
                                : 'border-gray-300 bg-white'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="mt-2 text-sm font-black text-purple-950">{layout.key}</p>
                    <p className="text-[11px] text-gray-500">{layout.label}</p>
                  </button>
                ))}
              </div>

              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-800">
                디자인 요소가 있는 상태에서 배열을 변경하면 확인 후 편집 내용이 초기화됩니다.
              </p>
            </section>

            <section className="rounded-3xl border border-purple-100 bg-white p-4 shadow-sm sm:p-5">
              <p className="text-xs font-bold text-violet-500">STEP 2</p>
              <h2 className="mt-1 text-lg font-black text-purple-950">키캡 색상</h2>
              <div className="mt-4 grid grid-cols-5 gap-2">
                {KEYCAP_COLORS.map((color) => (
                  <button
                    type="button"
                    key={color.key}
                    onClick={() => setSelectedColor(color.key)}
                    className={`rounded-2xl border p-2 transition ${
                      selectedColor === color.key ? 'border-violet-500 ring-2 ring-violet-100' : 'border-purple-100'
                    }`}
                    aria-label={color.label}
                  >
                    <span
                      className="mx-auto block h-9 w-9 rounded-xl border border-black/10 shadow-inner"
                      style={{ backgroundColor: color.hex }}
                    />
                    <span className="mt-1.5 block truncate text-[10px] font-bold text-gray-700">{color.label}</span>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-5 text-gray-500">
                화면의 색상은 실제 키캡과 최대한 비슷하게 표현한 참고용이며, 모니터와 출력 환경에 따라 차이가 날 수 있습니다.
              </p>
            </section>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>

          <div className="min-w-0">
            <section className="sticky top-4 rounded-3xl border border-purple-100 bg-white p-3 shadow-sm sm:p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-violet-500">EDIT AREA</p>
                  <h2 className="mt-1 text-lg font-black text-purple-950">시안 편집</h2>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={undo} disabled={!canUndo} className={toolButton}>실행 취소</button>
                  <button type="button" onClick={redo} disabled={!canRedo} className={toolButton}>다시 실행</button>
                  <button
                    type="button"
                    onClick={() => {
                      if (designObjectCount === 0 || window.confirm('모든 이미지와 텍스트를 삭제할까요?')) {
                        clearAllDesignObjects();
                      }
                    }}
                    disabled={designObjectCount === 0}
                    className={toolButton}
                  >
                    전체 초기화
                  </button>
                </div>
              </div>

              <div
                ref={canvasContainerRef}
                className="relative w-full overflow-hidden rounded-2xl border border-purple-100 bg-[#f8f7fb]"
                style={{ touchAction: 'pan-y' }}
              >
                <canvas ref={canvasElementRef} />
                {designObjectCount === 0 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="pointer-events-auto absolute left-1/2 top-1/2 z-10 w-auto max-w-[82%] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-violet-200 bg-white/95 px-4 py-3 text-center shadow-md backdrop-blur"
                  >
                    <span className="block text-sm font-black text-purple-950">+ 첫 사진 추가</span>
                    <span className="mt-0.5 block text-[10px] text-gray-500">JPG · PNG · WEBP · HEIC</span>
                  </button>
                )}
              </div>

              <p className="mt-3 text-center text-[11px] leading-5 text-gray-500">
                보라색 외곽선은 전체 작업 영역이며, 점선은 키캡별 안전 영역입니다.
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={imageCount >= MAX_IMAGES}
                  className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-3 text-sm font-black text-violet-700 transition hover:bg-violet-100 disabled:opacity-40"
                >
                  + 사진 추가 <span className="text-[10px] font-medium">({imageCount}/{MAX_IMAGES})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const canvas = canvasRef.current;
                    canvas?.discardActiveObject();
                    canvas?.requestRenderAll();
                    syncSelectionState(null);
                    setTextValue('');
                    setIsAddingText(true);
                    setShowTextEditor(true);
                  }}
                  className="rounded-xl border border-purple-200 bg-white px-3 py-3 text-sm font-black text-purple-800 transition hover:bg-purple-50"
                >
                  + 텍스트 추가
                </button>
              </div>

              {showTextEditor && (isAddingText || selectedObjectKind === 'text') && (
                <div className="mt-3 rounded-2xl border border-violet-200 bg-violet-50/40 p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-purple-950">
                        {selectedObjectKind === 'text' && !isAddingText ? '선택한 텍스트 편집' : '새 텍스트 추가'}
                      </p>
                      <p className="mt-0.5 text-[10px] text-gray-500">입력값은 선택한 텍스트에 바로 반영됩니다.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        // 선택 상태는 유지하고 편집 패널만 숨깁니다.
                        setShowTextEditor(false);
                        setIsAddingText(false);
                        if (selectedObjectKind !== 'text') setTextValue('');
                      }}
                      className="rounded-lg px-2 py-1 text-lg font-bold text-gray-400"
                      aria-label="텍스트 편집 닫기"
                    >
                      ×
                    </button>
                  </div>

                  <input
                    type="text"
                    value={textValue}
                    onChange={(event) => {
                      setTextValue(event.target.value);
                      if (selectedObjectKind === 'text' && !isAddingText) updateActiveText({ text: event.target.value });
                    }}
                    placeholder="각인할 문구를 입력해 주세요"
                    className="mt-3 w-full rounded-xl border border-purple-100 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  />

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {FONT_OPTIONS.map((font) => (
                      <button
                        type="button"
                        key={font.key}
                        onClick={() => {
                          setFontFamily(font.key);
                          if (selectedObjectKind === 'text' && !isAddingText) {
                            updateActiveText({ fontFamily: font.key });
                          }
                        }}
                        className={`rounded-xl border px-2 py-2 text-center transition ${
                          fontFamily === font.key ? 'border-violet-500 bg-white' : 'border-purple-100 bg-white/70'
                        }`}
                      >
                        <span className="block text-[11px] font-black text-purple-950">{font.label}</span>
                        <span className="mt-1 block truncate text-[9px] text-gray-500" style={{ fontFamily: font.key }}>
                          {font.sample}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {[
                      { label: 'Regular', value: 400 },
                      { label: 'Thick', value: 700 },
                    ].map((weight) => (
                      <button
                        type="button"
                        key={weight.value}
                        onClick={() => {
                          setFontWeight(weight.value);
                          if (selectedObjectKind === 'text' && !isAddingText) {
                            updateActiveText({ fontWeight: weight.value });
                          }
                        }}
                        className={`rounded-lg border py-2 text-[11px] font-bold transition ${
                          fontWeight === weight.value
                            ? 'border-violet-500 bg-violet-500 text-white'
                            : 'border-purple-100 bg-white text-gray-600'
                        }`}
                      >
                        {weight.label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-3 grid grid-cols-[90px_minmax(0,1fr)] items-end gap-3">
                    <label className="text-[11px] font-bold text-gray-600">
                      글자색
                      <input
                        type="color"
                        value={textColor}
                        onChange={(event) => {
                          setTextColor(event.target.value);
                          if (selectedObjectKind === 'text' && !isAddingText) updateActiveText({ fill: event.target.value });
                        }}
                        className="mt-1 h-9 w-full cursor-pointer rounded-lg border border-purple-100 bg-white p-1"
                      />
                    </label>

                    <p className="pb-1 text-[11px] leading-5 text-gray-500">
                      글자 크기는 캔버스에서 텍스트를 선택한 뒤 모서리 원을 드래그해 조절하세요.
                    </p>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <label className="text-[11px] font-bold text-gray-600">
                      자간
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          type="number"
                          min={-200}
                          max={800}
                          step={10}
                          value={letterSpacing}
                          onChange={(event) => {
                            const value = Math.max(-200, Math.min(800, Number(event.target.value)));
                            setLetterSpacing(value);
                            if (selectedObjectKind === 'text' && !isAddingText) updateActiveText({ charSpacing: value });
                          }}
                          className="h-10 min-w-0 flex-1 rounded-lg border border-purple-100 bg-white px-2 text-sm outline-none focus:border-violet-400"
                        />
                        <span className="text-[10px] text-gray-400">단위</span>
                      </div>
                    </label>

                    <label className="text-[11px] font-bold text-gray-600">
                      회전 각도
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          type="number"
                          min={-180}
                          max={180}
                          step={1}
                          value={textAngle}
                          onChange={(event) => {
                            const value = Math.max(-180, Math.min(180, Number(event.target.value)));
                            setTextAngle(value);
                            if (selectedObjectKind === 'text' && !isAddingText) updateActiveText({ angle: value });
                          }}
                          className="h-10 min-w-0 flex-1 rounded-lg border border-purple-100 bg-white px-2 text-sm outline-none focus:border-violet-400"
                        />
                        <span className="text-xs text-gray-500">°</span>
                      </div>
                    </label>
                  </div>

                  {isAddingText && (
                    <button
                      type="button"
                      onClick={addText}
                      className="mt-3 w-full rounded-xl bg-violet-500 py-3 text-sm font-black text-white shadow-md shadow-violet-100 transition hover:bg-violet-600"
                    >
                      캔버스에 텍스트 추가
                    </button>
                  )}
                </div>
              )}

              <div className="mt-4 rounded-2xl border border-purple-100 bg-[#fcfbff] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black text-purple-950">선택 요소 도구</p>
                    <p className="mt-0.5 text-[10px] text-gray-500">
                      {selectedObjectKind ? `${selectedObjectKind === 'image' ? '이미지' : selectedObjectKind === 'text' ? '텍스트' : '요소'}가 선택됨` : '캔버스에서 요소를 선택해 주세요.'}
                    </p>
                  </div>
                  <button type="button" onClick={deleteSelected} disabled={!selectedObjectKind} className={`${toolButton} text-red-600`}>
                    삭제
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <button type="button" onClick={() => moveLayer('front')} disabled={!selectedObjectKind} className={toolButton}>앞으로</button>
                  <button type="button" onClick={() => moveLayer('back')} disabled={!selectedObjectKind} className={toolButton}>뒤로</button>
                  <button type="button" onClick={() => alignToWhole('both')} disabled={!selectedObjectKind} className={toolButton}>전체 중앙</button>
                  <button type="button" onClick={alignToNearestCell} disabled={!selectedObjectKind} className={toolButton}>가까운 키 중앙</button>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => alignToWhole('horizontal')} disabled={!selectedObjectKind} className={toolButton}>가로 중앙</button>
                  <button type="button" onClick={() => alignToWhole('vertical')} disabled={!selectedObjectKind} className={toolButton}>세로 중앙</button>
                </div>

                <label className="mt-3 block text-xs font-bold text-gray-600">
                  투명도 {opacity}%
                  <input
                    type="range"
                    min={10}
                    max={100}
                    value={opacity}
                    disabled={!selectedObjectKind}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setOpacity(value);
                      updateActiveObject({ opacity: value / 100 });
                    }}
                    className="mt-2 w-full accent-violet-500 disabled:opacity-40"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={exportDesign}
                disabled={designObjectCount === 0}
                className="mt-4 w-full rounded-2xl bg-violet-500 py-4 text-base font-black text-white shadow-lg shadow-violet-100 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-purple-200 disabled:shadow-none"
              >
                {showOrderForm ? '✓ 최신 시안으로 다시 생성' : '편집 완료 및 시안 생성'}
              </button>
            </section>
          </div>
        </section>

        {showOrderForm && previewImageUrl && (
          <section ref={orderFormRef} className="grid scroll-mt-6 gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="rounded-3xl border border-purple-100 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-violet-500">FINAL PREVIEW</p>
                  <h2 className="mt-1 text-xl font-black text-purple-950">최종 시안 확인</h2>
                </div>
                <button type="button" onClick={downloadPreview} className={toolButton}>PNG 내려받기</button>
              </div>
              <div className="mt-4 overflow-hidden rounded-2xl border border-purple-100 bg-gray-100 p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewImageUrl} alt="완성된 키캡 시안" className="mx-auto max-h-[520px] w-auto max-w-full object-contain shadow-sm" />
              </div>
              <p className="mt-3 text-xs leading-5 text-gray-500">
                출력 크기: {selectedSpec.cols * UNIT_PIXELS}px × {selectedSpec.rows * UNIT_PIXELS}px · PNG
              </p>
            </div>

            <form onSubmit={handleOrderSubmit} className="rounded-3xl border border-purple-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold text-violet-500">STEP 5</p>
              <h2 className="mt-1 text-xl font-black text-purple-950">주문자 정보 입력</h2>

              <div className="mt-5 space-y-4">
                <label className="block text-sm font-bold text-gray-700">
                  접수 구분
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(['주문전', '주문완료'] as const).map((type) => (
                      <button
                        type="button"
                        key={type}
                        onClick={() => setOrderData((prev) => ({ ...prev, orderType: type }))}
                        className={`rounded-xl border py-3 text-sm font-black ${
                          orderData.orderType === type ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-purple-100 text-gray-600'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </label>

                <label className="block text-sm font-bold text-gray-700">
                  주문자 성함
                  <input
                    required
                    maxLength={15}
                    value={orderData.customerName}
                    onChange={(event) => setOrderData((prev) => ({ ...prev, customerName: event.target.value }))}
                    placeholder="홍길동"
                    className="mt-1.5 w-full rounded-xl border border-purple-100 px-3 py-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  />
                </label>

                <label className="block text-sm font-bold text-gray-700">
                  연락처
                  <input
                    required
                    inputMode="numeric"
                    value={orderData.contact}
                    onChange={(event) =>
                      setOrderData((prev) => ({
                        ...prev,
                        contact: event.target.value.replace(/\D/g, '').slice(0, 12),
                      }))
                    }
                    placeholder="01012345678"
                    className="mt-1.5 w-full rounded-xl border border-purple-100 px-3 py-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  />
                </label>

                <label className="block text-sm font-bold text-gray-700">
                  주문번호 <span className="text-xs font-normal text-gray-400">(주문완료 고객)</span>
                  <input
                    value={orderData.orderNumber}
                    onChange={(event) => setOrderData((prev) => ({ ...prev, orderNumber: event.target.value }))}
                    placeholder="스마트스토어 주문번호"
                    className="mt-1.5 w-full rounded-xl border border-purple-100 px-3 py-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  />
                </label>

                <label className="block text-sm font-bold text-gray-700">
                  이벤트 코드 <span className="text-xs font-normal text-gray-400">(선택 / 최대 8자)</span>
                  <input
                    maxLength={8}
                    value={orderData.eventCode}
                    onChange={(event) => setOrderData((prev) => ({ ...prev, eventCode: event.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-purple-100 px-3 py-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  />
                </label>

                <label className="block text-sm font-bold text-gray-700">
                  요청사항
                  <textarea
                    rows={4}
                    value={orderData.requestMessage}
                    onChange={(event) => setOrderData((prev) => ({ ...prev, requestMessage: event.target.value }))}
                    placeholder="제작 시 참고할 내용을 입력해 주세요."
                    className="mt-1.5 w-full resize-none rounded-xl border border-purple-100 px-3 py-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  />
                </label>

                <label className="flex cursor-pointer items-start gap-2 rounded-xl bg-purple-50/70 p-3 text-xs leading-5 text-gray-600">
                  <input
                    type="checkbox"
                    checked={orderData.privacyAgreed}
                    onChange={(event) => setOrderData((prev) => ({ ...prev, privacyAgreed: event.target.checked }))}
                    className="mt-1 h-4 w-4 accent-violet-500"
                  />
                  <span>시안 접수와 고객 확인을 위한 개인정보 수집 및 이용에 동의합니다.</span>
                </label>

                <button type="submit" className="w-full rounded-xl bg-violet-500 py-3.5 text-sm font-black text-white shadow-md shadow-violet-100 hover:bg-violet-600">
                  테스트 시안 접수
                </button>
                <p className="text-center text-[10px] leading-4 text-gray-400">
                  현재 버전은 Supabase에 전송하지 않으며 브라우저 콘솔에서 데이터 구조를 확인할 수 있습니다.
                </p>
              </div>
            </form>
          </section>
        )}
      </div>
    </main>
  );
}
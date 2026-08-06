'use client';

import * as fabric from 'fabric';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const UNIT_PIXELS = 250;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_IMAGES = 20;
const GAP_MM = 0.3;
const KEYCAP_MM = 18.6;
const MIN_CANVAS_ZOOM = 1;
const MAX_CANVAS_ZOOM = 3;
const CANVAS_ZOOM_STEP = 0.25;

const LAYOUTS = [
  { key: '1x1', rows: 1, cols: 1, label: '1칸' },
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
  { key: 'white', label: '화이트', hex: '#FEFEFE', text: '#111827' },
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

const TEXT_COLOR_PRESETS = [
  { label: '검정', value: '#111111' },
  { label: '흰색', value: '#FFFFFF' },
  { label: '빨강', value: '#EF4444' },
  { label: '주황', value: '#F97316' },
  { label: '노랑', value: '#FACC15' },
  { label: '초록', value: '#22C55E' },
  { label: '민트', value: '#14B8A6' },
  { label: '하늘', value: '#38BDF8' },
  { label: '파랑', value: '#2563EB' },
  { label: '보라', value: '#8B5CF6' },
  { label: '분홍', value: '#EC4899' },
  { label: '갈색', value: '#92400E' },
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
  const isPanModeRef = useRef(false);
  const isPanningRef = useRef(false);
  const lastPanPointRef = useRef({ x: 0, y: 0 });

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
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [isPanMode, setIsPanMode] = useState(false);

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

  const selectedSpecRef = useRef(selectedSpec);
const selectedColorSpecRef = useRef(selectedColorSpec);

useEffect(() => {
  selectedSpecRef.current = selectedSpec;
}, [selectedSpec]);

useEffect(() => {
  selectedColorSpecRef.current = selectedColorSpec;
}, [selectedColorSpec]);


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

          // 키캡 색상 면은 이미지와 텍스트 아래에 배치합니다.
          const keycapBackground = new fabric.Path(keycapPath, {
            left: cellLeft,
            top: cellTop,
            originX: 'left',
            originY: 'top',
            fill: colorHex,
            stroke: undefined,
            strokeWidth: 0,
            selectable: false,
            evented: false,
            excludeFromExport: true,
          });
          markAsGuideObject(keycapBackground, 'background');
          canvas.add(keycapBackground);

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

      // 키캡별 전체 외곽선 대신, 키캡 사이의 경계선만 이중선으로 표시합니다.
      // 흰색 굵은 선을 먼저 그리고 그 위에 얇은 검은색 선을 겹쳐
      // 밝거나 어두운 이미지에서도 경계가 잘 보이도록 합니다.
      const addInternalBoundary = (coords: [number, number, number, number]) => {
        const whiteHalo = new fabric.Line(coords, {
          stroke: 'rgba(255,255,255,0.9)',
          strokeWidth: 4,
          strokeUniform: true,
          selectable: false,
          evented: false,
          excludeFromExport: true,
        });

        const blackLine = new fabric.Line(coords, {
          stroke: 'rgba(17,24,39,0.88)',
          strokeWidth: 1.5,
          strokeUniform: true,
          selectable: false,
          evented: false,
          excludeFromExport: true,
        });

        markAsGuideObject(whiteHalo, 'overlay');
        markAsGuideObject(blackLine, 'overlay');
        canvas.add(whiteHalo, blackLine);
      };

      for (let col = 1; col < cols; col += 1) {
        const x = left + col * cellWidth + (col - 0.5) * gapPx;
        addInternalBoundary([x, top, x, top + guideHeight]);
      }

      for (let row = 1; row < rows; row += 1) {
        const y = top + row * cellHeight + (row - 0.5) * gapPx;
        addInternalBoundary([left, y, left + guideWidth, y]);
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

  const setDesignObjectsInteractive = useCallback((interactive: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.getObjects().filter(isDesignObject).forEach((obj) => {
      obj.set({
        selectable: interactive,
        evented: interactive,
      });
    });
  }, []);

  const applyPanMode = useCallback(
    (enabled: boolean) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const nextEnabled = enabled && canvas.getZoom() > MIN_CANVAS_ZOOM;
      isPanModeRef.current = nextEnabled;
      isPanningRef.current = false;
      setIsPanMode(nextEnabled);

      canvas.discardActiveObject();
      canvas.selection = !nextEnabled;
      setDesignObjectsInteractive(!nextEnabled);
      canvas.defaultCursor = nextEnabled ? 'grab' : 'default';
      canvas.hoverCursor = nextEnabled ? 'grab' : 'move';
      canvas.upperCanvasEl.style.touchAction = nextEnabled ? 'none' : 'pan-y';
      canvas.requestRenderAll();
      syncSelectionState(null);
    },
    [setDesignObjectsInteractive, syncSelectionState],
  );


  const clampViewportToGuide = useCallback((viewport: fabric.TMat2D) => {
    const canvas = canvasRef.current;
    if (!canvas) return viewport;

    const zoom = viewport[0];
    const bounds = guideBoundsRef.current;
    const canvasWidth = canvas.getWidth();
    const canvasHeight = canvas.getHeight();

    // 확대 시 배열의 각 끝부분을 화면 중앙까지 이동할 수 있도록 허용합니다.
    const minTranslateX = canvasWidth / 2 - (bounds.left + bounds.width) * zoom;
    const maxTranslateX = canvasWidth / 2 - bounds.left * zoom;
    const minTranslateY = canvasHeight / 2 - (bounds.top + bounds.height) * zoom;
    const maxTranslateY = canvasHeight / 2 - bounds.top * zoom;

    viewport[4] = Math.max(minTranslateX, Math.min(maxTranslateX, viewport[4]));
    viewport[5] = Math.max(minTranslateY, Math.min(maxTranslateY, viewport[5]));

    return viewport;
  }, []);

  const resetEditorViewport = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    setCanvasZoom(1);
    applyPanMode(false);
    canvas.requestRenderAll();
  }, [applyPanMode]);

  const setEditorZoom = useCallback(
    (requestedZoom: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const zoom = Math.max(MIN_CANVAS_ZOOM, Math.min(MAX_CANVAS_ZOOM, requestedZoom));
      const bounds = guideBoundsRef.current;
      const guideCenter = new fabric.Point(
        bounds.left + bounds.width / 2,
        bounds.top + bounds.height / 2,
      );

      // 배열 중심을 기준으로 확대해 양쪽 끝의 이동 가능 범위를 균형 있게 유지합니다.
      canvas.zoomToPoint(guideCenter, zoom);

      if (canvas.viewportTransform) {
        const nextViewport = clampViewportToGuide(
          [...canvas.viewportTransform] as fabric.TMat2D,
        );
        canvas.setViewportTransform(nextViewport);
      }

      setCanvasZoom(zoom);

      if (zoom <= MIN_CANVAS_ZOOM) {
        canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        applyPanMode(false);
      }

      canvas.requestRenderAll();
    },
    [applyPanMode, clampViewportToGuide],
  );


  // const updateCanvasSize = useCallback(() => {
  //   const canvas = canvasRef.current;
  //   const container = canvasContainerRef.current;
  //   if (!canvas || !container) return;
  //   const width = Math.max(280, Math.floor(container.clientWidth));
  //   const height = Math.max(360, Math.min(520, Math.round(width * 0.92)));
  //   canvas.setDimensions({ width, height });
  //   canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
  //   setCanvasZoom(1);
  //   isPanModeRef.current = false;
  //   setIsPanMode(false);
  //   canvas.selection = true;
  //   setDesignObjectsInteractive(true);
  //   drawGuides(canvas, selectedSpec.rows, selectedSpec.cols, selectedColorSpec.hex);
  // }, [drawGuides, selectedColorSpec.hex, selectedSpec.cols, selectedSpec.rows, setDesignObjectsInteractive]);
  const updateCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = canvasContainerRef.current;

    if (!canvas || !container) return;

    const width = Math.max(
      280,
      Math.floor(container.clientWidth),
    );

    const height = Math.max(
      360,
      Math.min(520, Math.round(width * 0.92)),
    );

    const currentSpec = selectedSpecRef.current;
    const currentColor = selectedColorSpecRef.current;

    canvas.setDimensions({
      width,
      height,
    });

    drawGuides(
      canvas,
      currentSpec.rows,
      currentSpec.cols,
      currentColor.hex,
    );

    arrangeGuideLayers(canvas);
    canvas.requestRenderAll();
  }, [arrangeGuideLayers, drawGuides]);

  useEffect(() => {
    if (!canvasElementRef.current || !canvasContainerRef.current) return;

    const width = Math.max(280, canvasContainerRef.current.clientWidth);
    const canvas = new fabric.Canvas(canvasElementRef.current, {
      width,
      height: Math.max(360, Math.min(520, Math.round(width * 0.92))),
      backgroundColor: '#FFFFFF',
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

    const upperCanvas = canvas.upperCanvasEl;
    let activePanPointerId: number | null = null;

    // 삼성 인터넷을 포함한 모바일 브라우저에서 안정적으로 동작하도록
    // Fabric의 mouse 이벤트 대신 DOM Pointer Events로 화면 이동을 처리합니다.
    const onPointerDown = (event: PointerEvent) => {
      if (!isPanModeRef.current || canvas.getZoom() <= MIN_CANVAS_ZOOM) return;

      // 두 번째 손가락이 들어오면 현재 화면 이동은 종료합니다.
      if (activePanPointerId !== null) return;

      event.preventDefault();
      event.stopPropagation();

      activePanPointerId = event.pointerId;
      isPanningRef.current = true;
      lastPanPointRef.current = {
        x: event.clientX,
        y: event.clientY,
      };

      try {
        upperCanvas.setPointerCapture(event.pointerId);
      } catch {
        // 일부 브라우저에서는 capture 호출이 실패할 수 있지만 이동 자체는 계속 허용합니다.
      }

      canvas.defaultCursor = 'grabbing';
      upperCanvas.style.cursor = 'grabbing';
    };

    const onPointerMove = (event: PointerEvent) => {
      if (
        !isPanModeRef.current ||
        !isPanningRef.current ||
        activePanPointerId !== event.pointerId
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const viewport = canvas.viewportTransform;
      if (!viewport) return;

      const deltaX = event.clientX - lastPanPointRef.current.x;
      const deltaY = event.clientY - lastPanPointRef.current.y;
      const nextViewport = [...viewport] as fabric.TMat2D;

      nextViewport[4] += deltaX;
      nextViewport[5] += deltaY;

      canvas.setViewportTransform(clampViewportToGuide(nextViewport));
      lastPanPointRef.current = {
        x: event.clientX,
        y: event.clientY,
      };
      canvas.requestRenderAll();
    };

    const finishPointerPan = (event?: PointerEvent) => {
      if (event && activePanPointerId !== event.pointerId) return;

      if (event) {
        event.preventDefault();
        event.stopPropagation();
        try {
          if (upperCanvas.hasPointerCapture(event.pointerId)) {
            upperCanvas.releasePointerCapture(event.pointerId);
          }
        } catch {
          // pointer capture 해제 실패는 무시합니다.
        }
      }

      activePanPointerId = null;
      isPanningRef.current = false;
      canvas.defaultCursor = isPanModeRef.current ? 'grab' : 'default';
      upperCanvas.style.cursor = isPanModeRef.current ? 'grab' : 'default';

      if (canvas.viewportTransform) {
        canvas.setViewportTransform(
          clampViewportToGuide([...canvas.viewportTransform] as fabric.TMat2D),
        );
      }
      canvas.requestRenderAll();
    };

    upperCanvas.addEventListener('pointerdown', onPointerDown, { passive: false });
    upperCanvas.addEventListener('pointermove', onPointerMove, { passive: false });
    upperCanvas.addEventListener('pointerup', finishPointerPan, { passive: false });
    upperCanvas.addEventListener('pointercancel', finishPointerPan, { passive: false });
    upperCanvas.addEventListener('lostpointercapture', finishPointerPan);

    // 객체를 터치할 때만 캔버스 제스처를 잡고, 빈 영역에서는 세로 스크롤 허용
    const onTouchStart = (event: TouchEvent) => {
      if (isPanModeRef.current) {
        upperCanvas.style.touchAction = 'none';
        return;
      }
      const target = canvas.findTarget(event)?.target;
      upperCanvas.style.touchAction = target && !isGuideObject(target) ? 'none' : 'pan-y';
    };
    const onTouchEnd = () => {
      upperCanvas.style.touchAction = isPanModeRef.current ? 'none' : 'pan-y';
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
      upperCanvas.removeEventListener('pointerdown', onPointerDown);
      upperCanvas.removeEventListener('pointermove', onPointerMove);
      upperCanvas.removeEventListener('pointerup', finishPointerPan);
      upperCanvas.removeEventListener('pointercancel', finishPointerPan);
      upperCanvas.removeEventListener('lostpointercapture', finishPointerPan);
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

  // const requestLayoutChange = (nextLayout: LayoutKey) => {
  //   if (nextLayout === selectedLayout) return;
  //   if (designObjectCount > 0) {
  //     const confirmed = window.confirm(
  //       '배열을 변경하면 현재 편집 중인 이미지와 텍스트가 모두 초기화됩니다. 배열을 변경할까요?',
  //     );
  //     if (!confirmed) return;
  //     clearAllDesignObjects(false);
  //   }
  //   resetEditorViewport();
  //   setSelectedLayout(nextLayout);
  //   setTimeout(() => resetHistory(), 0);
  // };
  const requestLayoutChange = (
  nextLayout: LayoutKey,
) => {
  if (nextLayout === selectedLayout) return;

  if (designObjectCount > 0) {
    const confirmed = window.confirm(
      '배열을 변경하면 현재 편집 중인 이미지와 텍스트가 모두 초기화됩니다. 배열을 변경할까요?',
    );

    if (!confirmed) return;

    clearAllDesignObjects(false);
  }

  const nextSpec =
    LAYOUTS.find(
      (layout) => layout.key === nextLayout,
    ) ?? LAYOUTS[0];

  // ResizeObserver가 중간에 실행돼도
  // 새로운 배열을 사용하도록 먼저 갱신
  selectedSpecRef.current = nextSpec;

  resetEditorViewport();
  setSelectedLayout(nextLayout);

  setTimeout(() => {
    resetHistory();
  }, 0);
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
    applyPanMode(false);

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
    applyPanMode(false);
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

    const previousViewport = canvas.viewportTransform
      ? ([...canvas.viewportTransform] as fabric.TMat2D)
      : ([1, 0, 0, 1, 0, 0] as fabric.TMat2D);


    const previousBackgroundColor = canvas.backgroundColor;

    // 출력에는 편집용 배경색이 포함되지 않도록 제거
    canvas.backgroundColor = 'rgba(0,0,0,0)';

    canvas.setViewportTransform([
      1, 0,
      0, 1,
      0, 0,
    ]);

    
    canvas.discardActiveObject();
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    
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
    if (!context) {
      guides.forEach((obj) => obj.set({ visible: true }));
      canvas.setViewportTransform(previousViewport);
      arrangeGuideLayers(canvas);
      canvas.requestRenderAll();
      return;
    }
    // 저장될 이미지에 키캡색 포함
    // context.fillStyle = selectedColorSpec.hex;
    // context.fillRect(0, 0, targetWidth, targetHeight);
    context.drawImage(cropped, 0, 0, targetWidth, targetHeight);
    const dataUrl = outputCanvas.toDataURL('image/png', 1);


    // 편집 화면 복원
    canvas.backgroundColor = previousBackgroundColor;
    canvas.setViewportTransform(previousViewport);


    guides.forEach((obj) => obj.set({ visible: true }));
    canvas.setViewportTransform(previousViewport);
    arrangeGuideLayers(canvas);
    canvas.requestRenderAll();

    setPreviewImageUrl(dataUrl);
    setShowOrderForm(true);
    setTimeout(() => orderFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

 const handleOrderSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (isSubmitting) return;

    const name =
      orderData.customerName.trim();

    const contact =
      orderData.contact.trim();

    const eventCode =
      orderData.eventCode.trim();

    const requestMessage =
      orderData.requestMessage.trim();

    /*
    * 1. 브라우저 입력값 검사
    */
    if (!name) {
      alert(
        '주문자 이름을 입력해 주세요.',
      );
      return;
    }

    if (name.length > 15) {
      alert(
        '이름은 최대 15글자까지 입력할 수 있습니다.',
      );
      return;
    }

    const isValidContact =
      /^010\d{8}$/.test(contact) ||
      /^050\d{9}$/.test(contact);

    if (!isValidContact) {
      alert(
        '010 또는 050으로 시작하는 올바른 연락처를 입력해 주세요.',
      );
      return;
    }

    if (eventCode.length > 8) {
      alert(
        '이벤트 코드는 최대 8자입니다.',
      );
      return;
    }

    if (!orderData.privacyAgreed) {
      alert(
        '개인정보 수집 및 이용에 동의해 주세요.',
      );
      return;
    }

    if (!previewImageUrl) {
      alert(
        '편집 완료 버튼을 다시 눌러 시안을 생성해 주세요.',
      );
      return;
    }

    try {
      setIsSubmitting(true);
      setNotice(null);

      /*
      * 2. Canvas에서 생성된 Data URL을
      * PNG Blob으로 변환
      */
      const imageResponse =
        await fetch(previewImageUrl);

      if (!imageResponse.ok) {
        throw new Error(
          '시안 이미지를 파일로 변환하지 못했습니다.',
        );
      }

      const imageBlob =
        await imageResponse.blob();

      if (
        imageBlob.size <= 0
      ) {
        throw new Error(
          '생성된 시안 이미지가 비어있습니다.',
        );
      }

      if (
        imageBlob.size >
        10 * 1024 * 1024
      ) {
        throw new Error(
          '시안 이미지의 용량이 10MB를 초과했습니다.',
        );
      }

      /*
      * 3. FormData 구성
      */
      const formData =
        new FormData();

      formData.append(
        'previewImage',
        imageBlob,
        `keycap-${selectedLayout}-${selectedColor}.png`,
      );

      formData.append(
        'customerName',
        name,
      );

      formData.append(
        'contact',
        contact,
      );

      formData.append(
        'color',
        selectedColor,
      );

      formData.append(
        'size',
        selectedLayout,
      );

      formData.append(
        'orderType',
        orderData.orderType,
      );

      formData.append(
        'eventCode',
        eventCode,
      );

      formData.append(
        'request',
        requestMessage,
      );

      formData.append(
        'productName',
        '포토키캡키링',
      );

      /*
      * 4. API 전송
      *
      * FormData를 보낼 때 Content-Type을 직접
      * 지정하지 않아야 브라우저가 boundary를
      * 자동으로 추가합니다.
      */
      const response = await fetch(
        '/api/design-order',
        {
          method: 'POST',
          body: formData,
        },
      );

      const result = await response.json();

      if (response.status === 429) {
        throw new Error(
          result.error ??
            '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
        );
      }

      if (!response.ok) {
        throw new Error(
          result.error ??
            '시안 접수 중 오류가 발생했습니다.',
        );
      }

      /*
      * 5. 성공 처리
      */
      setNotice(
        '시안 접수가 완료되었습니다. 확인 후 연락드리겠습니다.',
      );

      console.log(
        '시안 접수 완료:',
        {
          orderId:
            result.orderId,
          previewImageUrl:
            result.previewImageUrl,
          createdAt:
            result.createdAt,
        },
      );

      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });

      /*
      * 중복 접수를 막기 위해
      * 주문 폼을 닫을 수도 있습니다.
      */
      setShowOrderForm(false);

      // 필요하면 입력값 초기화
      setOrderData({
        orderType: '주문전',
        customerName: '',
        contact: '',
        orderNumber: '',
        requestMessage: '',
        eventCode: '',
        privacyAgreed: false,
      });

      setPreviewImageUrl(null);
    } catch (error: unknown) {
      console.error(
        '시안 접수 오류:',
        error,
      );

      alert(
        error instanceof Error
          ? error.message
          : '시안 접수 중 오류가 발생했습니다.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadPreview = () => {
    if (!previewImageUrl) return;
    const anchor = document.createElement('a');
    anchor.href = previewImageUrl;
    anchor.download = `keycap-${selectedLayout}-${selectedColor}.png`;
    anchor.click();
  };

  const [isSubmitting, setIsSubmitting] =
  useState(false);

  const changeKeycapColor = (
  nextColor: KeycapColorKey,
) => {
  const nextColorSpec =
    KEYCAP_COLORS.find(
      (color) => color.key === nextColor,
    ) ?? KEYCAP_COLORS[0];

  selectedColorSpecRef.current =
    nextColorSpec;

  setSelectedColor(nextColor);
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
                    // onClick={() => setSelectedColor(color.key)}
                    onClick={() =>
                      changeKeycapColor(color.key)
                    }
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

                <div className="pointer-events-auto absolute bottom-3 left-1/2 z-20 flex w-max -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-2xl border border-purple-100 bg-white/95 p-1.5 shadow-lg backdrop-blur">
                  <button
                    type="button"
                    onClick={() => setEditorZoom(canvasZoom - CANVAS_ZOOM_STEP)}
                    disabled={canvasZoom <= MIN_CANVAS_ZOOM}
                    className="flex h-9 w-4 shrink-0 items-center justify-center rounded-xl text-lg font-black text-purple-900 transition hover:bg-purple-50 disabled:opacity-30"
                    aria-label="캔버스 축소"
                  >
                    −
                  </button>

                  <span className="min-w-[25px] text-center text-[11px] font-black text-violet-700">
                    {Math.round(canvasZoom * 100)}%
                  </span>

                  <button
                    type="button"
                    onClick={() => setEditorZoom(canvasZoom + CANVAS_ZOOM_STEP)}
                    disabled={canvasZoom >= MAX_CANVAS_ZOOM}
                    className="flex h-9 w-4 shrink-0 items-center justify-center rounded-xl text-lg font-black text-purple-900 transition hover:bg-purple-50 disabled:opacity-30"
                    aria-label="캔버스 확대"
                  >
                    +
                  </button>

                  <div className="mx-0.5 h-5 w-px shrink-0 bg-purple-100" />

                  <button
                    type="button"
                    onClick={() => applyPanMode(!isPanMode)}
                    disabled={canvasZoom <= MIN_CANVAS_ZOOM}
                    className={`shrink-0 rounded-xl px-2.5 py-2 text-[11px] font-black transition ${
                      isPanMode
                        ? 'bg-violet-500 text-white'
                        : 'text-purple-800 hover:bg-purple-50'
                    } disabled:opacity-30`}
                  >
                    {isPanMode ? '이동 중' : '화면 이동'}
                  </button>
                    
                  <button
                    type="button"
                    onClick={resetEditorViewport}
                    disabled={canvasZoom <= MIN_CANVAS_ZOOM}
                    className="shrink-0 rounded-xl px-2.5 py-2 text-[11px] font-black text-purple-800 transition hover:bg-purple-50 disabled:opacity-30"
                  >
                    전체보기
                  </button>
                </div>

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
                보라색 외곽선은 전체 작업 영역이며, 점선은 키캡별 안전 영역입니다. 확대 후 화면 이동 모드로 미세 위치를 조정할 수 있습니다.
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

                  <div className="mt-3 rounded-xl border border-purple-100 bg-white/80 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-bold text-gray-600">글자색</p>
                        <p className="mt-0.5 text-[10px] text-gray-400">자주 쓰는 색상을 누르거나 직접 선택하세요.</p>
                      </div>
                      <div className="flex items-center gap-2 rounded-full border border-purple-100 bg-white px-2.5 py-1.5">
                        <span
                          className="h-5 w-5 rounded-full border border-black/15 shadow-inner"
                          style={{ backgroundColor: textColor }}
                        />
                        <span className="font-mono text-[10px] font-bold uppercase text-gray-500">{textColor}</span>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-6 gap-2 sm:grid-cols-12">
                      {TEXT_COLOR_PRESETS.map((preset) => {
                        const isSelected = textColor.toUpperCase() === preset.value.toUpperCase();
                        return (
                          <button
                            key={preset.value}
                            type="button"
                            onClick={() => {
                              setTextColor(preset.value);
                              if (selectedObjectKind === 'text' && !isAddingText) {
                                updateActiveText({ fill: preset.value });
                              }
                            }}
                            className={`relative mx-auto h-9 w-9 rounded-full border shadow-sm transition active:scale-90 ${
                              isSelected
                                ? 'border-violet-500 ring-2 ring-violet-200 ring-offset-2'
                                : 'border-black/10 hover:scale-105'
                            }`}
                            style={{ backgroundColor: preset.value }}
                            aria-label={`${preset.label} 선택`}
                            title={preset.label}
                          >
                            {isSelected && (
                              <span
                                className={`absolute inset-0 flex items-center justify-center text-sm font-black ${
                                  preset.value === '#FFFFFF' || preset.value === '#FACC15'
                                    ? 'text-gray-800'
                                    : 'text-white'
                                }`}
                              >
                                ✓
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-violet-50/60 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-[11px] font-black text-purple-950">사용자 지정 색상</p>
                        <p className="truncate text-[10px] text-gray-500">원하는 색을 직접 선택할 수 있습니다.</p>
                      </div>

                      <label className="relative flex h-10 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-violet-200 bg-white shadow-sm">
                        <span
                          className="absolute inset-1 rounded-lg border border-black/10"
                          style={{ backgroundColor: textColor }}
                        />
                        <span className="relative rounded-md bg-black/45 px-2 py-1 text-[10px] font-black text-white backdrop-blur">선택</span>
                        <input
                          type="color"
                          value={textColor}
                          onChange={(event) => {
                            const nextColor = event.target.value.toUpperCase();
                            setTextColor(nextColor);
                            if (selectedObjectKind === 'text' && !isAddingText) {
                              updateActiveText({ fill: nextColor });
                            }
                          }}
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                          aria-label="사용자 지정 글자색 선택"
                        />
                      </label>
                    </div>

                    <p className="mt-3 text-[11px] leading-5 text-gray-500">
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

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-xl bg-violet-500 py-3.5 text-sm font-black text-white shadow-md shadow-violet-100 transition hover:bg-violet-600 disabled:cursor-not-allowed disabled:bg-purple-300 disabled:shadow-none"
                >
                  {isSubmitting
                    ? '시안 접수 중...'
                    : '시안 접수하기'}
                </button>
                <p className="text-center text-[10px] leading-4 text-gray-400">
                  시안 이미지 업로드가 완료된 후 접수정보가 저장됩니다.
                </p>
              </div>
            </form>
          </section>
        )}
      </div>
      {isSubmitting && (
  <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/65 px-4 text-center backdrop-blur-sm">
    <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/30 border-t-white" />

    <p className="mt-4 text-lg font-black text-white">
      시안을 접수하고 있습니다
    </p>

    <p className="mt-1 text-xs text-white/70">
      이미지 업로드가 완료될 때까지 화면을 닫지 마세요.
    </p>
  </div>
)}
    </main>
  );
  
}

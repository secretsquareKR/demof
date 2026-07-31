'use client';

import {
  ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Canvas,
  FabricImage,
  Line,
  Rect,
  Textbox,
} from 'fabric';

type LayoutType = '1x1' | '1x3' | '1x4' | '2x3';

type LayoutConfig = {
  label: string;
  rows: number;
  columns: number;
};

const LAYOUTS: Record<LayoutType, LayoutConfig> = {
  '1x1': {
    label: '1 × 1',
    rows: 1,
    columns: 1,
  },
  '1x3': {
    label: '1 × 3',
    rows: 1,
    columns: 3,
  },
  '1x4': {
    label: '1 × 4',
    rows: 1,
    columns: 4,
  },
  '2x3': {
    label: '2 × 3',
    rows: 2,
    columns: 3,
  },
};

/**
 * 편집용 픽셀 크기다.
 * 실제 키캡 크기 18.2mm를 그대로 px로 쓰지 않고,
 * 편집하기 편하도록 확대해 사용한다.
 */
const KEY_SIZE = 180;
const KEY_GAP = 10;
const CANVAS_PADDING = 30;

const GUIDE_NAME = 'keycap-guide';

function getCanvasDimensions(layoutType: LayoutType) {
  const layout = LAYOUTS[layoutType];

  return {
    width:
      layout.columns * KEY_SIZE +
      (layout.columns - 1) * KEY_GAP +
      CANVAS_PADDING * 2,

    height:
      layout.rows * KEY_SIZE +
      (layout.rows - 1) * KEY_GAP +
      CANVAS_PADDING * 2,
  };
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64Data] = dataUrl.split(',');

  if (!header || !base64Data) {
    throw new Error('시안 이미지 변환에 실패했습니다.');
  }

  const mimeMatch = header.match(/data:(.*?);base64/);
  const mimeType = mimeMatch?.[1] ?? 'image/png';

  const binary = window.atob(base64Data);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], {
    type: mimeType,
  });
}

export default function KeycapEditorPage() {
  const htmlCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fabricCanvasRef = useRef<Canvas | null>(null);

  const [layoutType, setLayoutType] =
    useState<LayoutType>('1x3');

  const [textValue, setTextValue] = useState('F1');
  const [textColor, setTextColor] = useState('#111827');

  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [memo, setMemo] = useState('');

  const [previewUrl, setPreviewUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const drawKeycapGuides = useCallback(
    (canvas: Canvas, selectedLayout: LayoutType) => {
      const layout = LAYOUTS[selectedLayout];

      const guideObjects = canvas
        .getObjects()
        .filter(
          (object) =>
            object.get('name') === GUIDE_NAME,
        );

      canvas.remove(...guideObjects);

      for (let row = 0; row < layout.rows; row += 1) {
        for (
          let column = 0;
          column < layout.columns;
          column += 1
        ) {
          const left =
            CANVAS_PADDING +
            column * (KEY_SIZE + KEY_GAP);

          const top =
            CANVAS_PADDING +
            row * (KEY_SIZE + KEY_GAP);

          const keyBackground = new Rect({
            left,
            top,
            width: KEY_SIZE,
            height: KEY_SIZE,
            rx: 18,
            ry: 18,

            fill: 'rgba(255,255,255,0.82)',
            stroke: '#94a3b8',
            strokeWidth: 2,

            selectable: false,
            evented: false,
            excludeFromExport: false,
            name: GUIDE_NAME,
          });

          const safeArea = new Rect({
            left: left + 12,
            top: top + 12,
            width: KEY_SIZE - 24,
            height: KEY_SIZE - 24,
            rx: 12,
            ry: 12,

            fill: 'transparent',
            stroke: '#cbd5e1',
            strokeWidth: 1,
            strokeDashArray: [8, 6],

            selectable: false,
            evented: false,
            excludeFromExport: false,
            name: GUIDE_NAME,
          });

          canvas.add(keyBackground);
          canvas.add(safeArea);
        }
      }

      /**
       * 가이드가 이미지나 텍스트보다 뒤에 있도록 한다.
       */
      const allGuides = canvas
        .getObjects()
        .filter(
          (object) =>
            object.get('name') === GUIDE_NAME,
        );

      allGuides.reverse().forEach((guide) => {
        canvas.sendObjectToBack(guide);
      });

      canvas.requestRenderAll();
    },
    [],
  );

  const resetCanvas = useCallback(
    (selectedLayout: LayoutType) => {
      const canvas = fabricCanvasRef.current;

      if (!canvas) {
        return;
      }

      const dimensions =
        getCanvasDimensions(selectedLayout);

      canvas.clear();
      canvas.setDimensions(dimensions);
      canvas.backgroundColor = '#e2e8f0';

      drawKeycapGuides(canvas, selectedLayout);

      setPreviewUrl('');
      setSaveMessage('');
    },
    [drawKeycapGuides],
  );

  useEffect(() => {
    if (!htmlCanvasRef.current) {
      return;
    }

    const dimensions = getCanvasDimensions(layoutType);

    const canvas = new Canvas(htmlCanvasRef.current, {
      width: dimensions.width,
      height: dimensions.height,
      backgroundColor: '#e2e8f0',

      preserveObjectStacking: true,
      selection: true,
    });

    fabricCanvasRef.current = canvas;
    drawKeycapGuides(canvas, layoutType);

    return () => {
      canvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, [drawKeycapGuides]);

  useEffect(() => {
    resetCanvas(layoutType);
  }, [layoutType, resetCanvas]);

  const handleImageUpload = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    const canvas = fabricCanvasRef.current;

    if (!file || !canvas) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 첨부할 수 있습니다.');
      event.target.value = '';
      return;
    }

    const objectUrl = URL.createObjectURL(file);

    try {
      const image = await FabricImage.fromURL(objectUrl);

      const dimensions = getCanvasDimensions(layoutType);

      const availableWidth =
        dimensions.width - CANVAS_PADDING * 2;

      const availableHeight =
        dimensions.height - CANVAS_PADDING * 2;

      const imageWidth = image.width || 1;
      const imageHeight = image.height || 1;

      const coverScale = Math.max(
        availableWidth / imageWidth,
        availableHeight / imageHeight,
      );

      image.set({
        left: dimensions.width / 2,
        top: dimensions.height / 2,

        originX: 'center',
        originY: 'center',

        scaleX: coverScale,
        scaleY: coverScale,

        cornerSize: 18,
        transparentCorners: false,
        borderColor: '#2563eb',
        cornerColor: '#2563eb',
      });

      canvas.add(image);

      /**
       * 이미지가 가이드 뒤로 완전히 내려가면
       * 선택이 어려우므로, 추가 후 가이드만 다시 뒤로 보낸다.
       */
      const guides = canvas
        .getObjects()
        .filter(
          (object) =>
            object.get('name') === GUIDE_NAME,
        );

      guides.reverse().forEach((guide) => {
        canvas.sendObjectToBack(guide);
      });

      canvas.setActiveObject(image);
      canvas.requestRenderAll();

      setPreviewUrl('');
      setSaveMessage('');
    } catch (error) {
      console.error(error);
      alert('이미지를 불러오지 못했습니다.');
    } finally {
      URL.revokeObjectURL(objectUrl);
      event.target.value = '';
    }
  };

  const handleAddText = () => {
    const canvas = fabricCanvasRef.current;

    if (!canvas) {
      return;
    }

    const value = textValue.trim();

    if (!value) {
      alert('추가할 문구를 입력해주세요.');
      return;
    }

    const dimensions = getCanvasDimensions(layoutType);

    const textbox = new Textbox(value, {
      left: dimensions.width / 2,
      top: dimensions.height / 2,

      originX: 'center',
      originY: 'center',

      width: Math.min(
        dimensions.width - 80,
        KEY_SIZE * 2.5,
      ),

      fontSize: 42,
      fontWeight: 700,
      fontFamily: 'Arial, sans-serif',
      textAlign: 'center',
      fill: textColor,

      cornerSize: 18,
      transparentCorners: false,
      borderColor: '#7c3aed',
      cornerColor: '#7c3aed',
    });

    canvas.add(textbox);
    canvas.setActiveObject(textbox);
    canvas.requestRenderAll();

    setPreviewUrl('');
    setSaveMessage('');
  };

  const handleDeleteSelected = () => {
    const canvas = fabricCanvasRef.current;

    if (!canvas) {
      return;
    }

    const selectedObjects =
      canvas.getActiveObjects();

    const deletableObjects = selectedObjects.filter(
      (object) =>
        object.get('name') !== GUIDE_NAME,
    );

    if (deletableObjects.length === 0) {
      return;
    }

    canvas.remove(...deletableObjects);
    canvas.discardActiveObject();
    canvas.requestRenderAll();

    setPreviewUrl('');
    setSaveMessage('');
  };

  const handleBringForward = () => {
    const canvas = fabricCanvasRef.current;
    const activeObject = canvas?.getActiveObject();

    if (
      !canvas ||
      !activeObject ||
      activeObject.get('name') === GUIDE_NAME
    ) {
      return;
    }

    canvas.bringObjectForward(activeObject);
    canvas.requestRenderAll();
  };

  const handleSendBackward = () => {
    const canvas = fabricCanvasRef.current;
    const activeObject = canvas?.getActiveObject();

    if (
      !canvas ||
      !activeObject ||
      activeObject.get('name') === GUIDE_NAME
    ) {
      return;
    }

    canvas.sendObjectBackwards(activeObject);

    const guides = canvas
      .getObjects()
      .filter(
        (object) =>
          object.get('name') === GUIDE_NAME,
      );

    guides.reverse().forEach((guide) => {
      canvas.sendObjectToBack(guide);
    });

    canvas.requestRenderAll();
  };

  const createPreviewDataUrl = () => {
    const canvas = fabricCanvasRef.current;

    if (!canvas) {
      throw new Error('캔버스가 준비되지 않았습니다.');
    }

    canvas.discardActiveObject();
    canvas.requestRenderAll();

    /**
     * multiplier를 키우면 저장되는 PNG 해상도가 높아진다.
     * 테스트 단계에서는 2배로 설정한다.
     */
    return canvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 2,
    });
  };

  const handleCreatePreview = () => {
    try {
      const dataUrl = createPreviewDataUrl();
      setPreviewUrl(dataUrl);
      setSaveMessage('');
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : '미리보기를 생성하지 못했습니다.',
      );
    }
  };

  const handleSave = async () => {
    const canvas = fabricCanvasRef.current;

    if (!canvas || isSaving) {
      return;
    }

    setIsSaving(true);
    setSaveMessage('');

    try {
      const dataUrl = createPreviewDataUrl();
      const imageBlob = dataUrlToBlob(dataUrl);

      /**
       * 편집 내용을 나중에 다시 불러올 수 있도록
       * Fabric JSON도 함께 저장한다.
       */
      const fabricJson = canvas.toJSON([
        'name',
      ]);

      const formData = new FormData();

      formData.append(
        'image',
        imageBlob,
        `keycap-${layoutType}.png`,
      );

      formData.append('layoutType', layoutType);
      formData.append(
        'fabricJson',
        JSON.stringify(fabricJson),
      );

      formData.append('customerName', customerName);
      formData.append('phone', phone);
      formData.append('memo', memo);

      const response = await fetch(
        '/api/keycap-design',
        {
          method: 'POST',
          body: formData,
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ||
            '시안 저장에 실패했습니다.',
        );
      }

      setPreviewUrl(dataUrl);

      setSaveMessage(
        `저장 완료: ${result.design.id}`,
      );
    } catch (error) {
      console.error(error);

      setSaveMessage(
        error instanceof Error
          ? error.message
          : '저장 중 오류가 발생했습니다.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <p className="mb-2 text-sm font-semibold text-violet-600">
            DIMOF KEYCAP EDITOR
          </p>

          <h1 className="text-3xl font-bold text-slate-900">
            펑션 키캡 시안 만들기
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            사진과 문구를 배치한 후 최종 시안을
            Supabase에 저장할 수 있습니다.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-5 rounded-3xl bg-white p-5 shadow-sm">
            <section>
              <h2 className="mb-3 font-bold text-slate-900">
                1. 배열 선택
              </h2>

              <div className="grid grid-cols-2 gap-2">
                {(
                  Object.entries(LAYOUTS) as [
                    LayoutType,
                    LayoutConfig,
                  ][]
                ).map(([value, layout]) => {
                  const selected =
                    layoutType === value;

                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        setLayoutType(value)
                      }
                      className={[
                        'rounded-xl border px-3 py-3 text-sm font-semibold transition',
                        selected
                          ? 'border-violet-600 bg-violet-50 text-violet-700'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-violet-300',
                      ].join(' ')}
                    >
                      {layout.label}
                    </button>
                  );
                })}
              </div>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                배열을 변경하면 현재 편집 내용은
                초기화됩니다.
              </p>
            </section>

            <section>
              <h2 className="mb-3 font-bold text-slate-900">
                2. 사진 넣기
              </h2>

              <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-700 hover:border-violet-400 hover:bg-violet-50">
                이미지 선택
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </section>

            <section>
              <h2 className="mb-3 font-bold text-slate-900">
                3. 문구 넣기
              </h2>

              <div className="space-y-2">
                <input
                  value={textValue}
                  onChange={(event) =>
                    setTextValue(event.target.value)
                  }
                  placeholder="예: ESC, F1, HELLO"
                  className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-violet-500"
                />

                <div className="flex gap-2">
                  <input
                    type="color"
                    value={textColor}
                    onChange={(event) =>
                      setTextColor(
                        event.target.value,
                      )
                    }
                    className="h-11 w-14 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                  />

                  <button
                    type="button"
                    onClick={handleAddText}
                    className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
                  >
                    문구 추가
                  </button>
                </div>
              </div>
            </section>

            <section>
              <h2 className="mb-3 font-bold text-slate-900">
                4. 선택 요소 편집
              </h2>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleBringForward}
                  className="rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-700"
                >
                  앞으로
                </button>

                <button
                  type="button"
                  onClick={handleSendBackward}
                  className="rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-700"
                >
                  뒤로
                </button>

                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  className="col-span-2 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm font-semibold text-red-600"
                >
                  선택 요소 삭제
                </button>
              </div>
            </section>

            <section className="space-y-2 border-t border-slate-100 pt-5">
              <h2 className="font-bold text-slate-900">
                주문 정보
              </h2>

              <input
                value={customerName}
                onChange={(event) =>
                  setCustomerName(event.target.value)
                }
                placeholder="고객 이름"
                className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-violet-500"
              />

              <input
                value={phone}
                onChange={(event) =>
                  setPhone(event.target.value)
                }
                placeholder="연락처"
                className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-violet-500"
              />

              <textarea
                value={memo}
                onChange={(event) =>
                  setMemo(event.target.value)
                }
                placeholder="요청사항"
                rows={3}
                className="w-full resize-none rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-violet-500"
              />
            </section>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCreatePreview}
                className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-bold text-violet-700"
              >
                미리보기
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving
                  ? '저장 중...'
                  : '시안 저장'}
              </button>
            </div>

            {saveMessage && (
              <p className="break-all rounded-xl bg-slate-100 px-3 py-3 text-xs leading-5 text-slate-700">
                {saveMessage}
              </p>
            )}
          </aside>

          <section className="min-w-0 rounded-3xl bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4">
              <h2 className="font-bold text-slate-900">
                편집 화면
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                이미지를 드래그하고 모서리 핸들로
                크기와 회전을 조절하세요.
              </p>
            </div>

            <div className="overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="w-max">
                <canvas ref={htmlCanvasRef} />
              </div>
            </div>

            {previewUrl && (
              <div className="mt-6 border-t border-slate-100 pt-6">
                <h2 className="mb-3 font-bold text-slate-900">
                  최종 시안 이미지
                </h2>

                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="키캡 최종 시안"
                  className="max-h-[500px] max-w-full rounded-2xl border border-slate-200 bg-slate-100 object-contain"
                />
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
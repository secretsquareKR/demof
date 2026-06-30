'use client';

import { Canvas, Circle, Rect } from 'fabric';
import { useEffect, useRef } from 'react';

export default function CanvasPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fabricCanvasRef = useRef<Canvas | null>(null);
// src/app/canvas/page.tsx 의 useEffect 부분 수정

useEffect(() => {
  if (typeof window === 'undefined' || !canvasRef.current) return;

  const containerWidth = Math.min(window.innerWidth - 40, 600);

  // 대문자 Canvas 인스턴스 생성
  const canvas = new Canvas(canvasRef.current, {
    width: containerWidth,
    height: 400,
    backgroundColor: '#eeeeee',
    
    // 🔥 모바일 터치 환경을 위한 필수 안정화 옵션
    enablePointerEvents: true, // 포인터 이벤트 강제 활성화
    allowTouchScrolling: false, // 캔버스 조작 중 브라우저 스크롤이 간섭하지 못하게 차단
  });

  const rect = new Rect({
    top: 100,
    left: 100,
    width: 100,
    height: 100,
    fill: 'red',
  });
  canvas.add(rect);

  const circle = new Circle({
    top: 150,
    left: 200,
    radius: 50,
    fill: 'blue',
  });
  canvas.add(circle);

  fabricCanvasRef.current = canvas;

  // 🔥 초기 렌더링 후 모바일 화면에 강제로 즉시 반영시키기
  setTimeout(() => {
    canvas.requestRenderAll();
  }, 100);

  const handleResize = () => {
    if (fabricCanvasRef.current) {
      const newWidth = Math.min(window.innerWidth - 40, 600);
      fabricCanvasRef.current.setDimensions({ width: newWidth, height: 400 });
      fabricCanvasRef.current.requestRenderAll();
    }
  };
  window.addEventListener('resize', handleResize);

  return () => {
    window.removeEventListener('resize', handleResize);
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.dispose();
      fabricCanvasRef.current = null;
    }
  };
}, []);

  const addRandomRect = () => {
    if (fabricCanvasRef.current) {
      const rect = new Rect({
        top: Math.random() * 200,
        left: Math.random() * 200,
        width: 60,
        height: 60,
        fill: 'green',
      });
      fabricCanvasRef.current.add(rect);
      
      // 모바일 기기에서 변화를 즉시 감지하고 다시 그리도록 명령
      fabricCanvasRef.current.renderAll(); 
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Fabric.js Canvas 실습</h1>
      <div style={styles.buttonContainer}>
        {/* 모바일에서 버튼 터치가 잘 되도록 패딩 확대 */}
        <button onClick={addRandomRect} style={styles.button}>
          초록 사각형 추가
        </button>
      </div>
      <div style={styles.canvasWrapper}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: '20px', // 모바일 여백 축소
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  title: {
    marginBottom: '20px',
    fontSize: '20px', // 모바일 타이틀 폰트 조절
  },
  buttonContainer: {
    marginBottom: '20px',
  },
  button: {
    padding: '14px 28px', // 터치하기 쉽게 크기 확장
    fontSize: '16px',
    backgroundColor: '#0070f3',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    touchAction: 'manipulation', // 모바일 터치 딜레이 제거
  },
  canvasWrapper: {
    border: '2px solid #333',
    boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
    maxWidth: '100%',
    overflow: 'hidden', // 모바일에서 삐져나오는 현상 방지
  },
};
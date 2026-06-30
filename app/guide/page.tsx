'use client';
import Link from "next/link";


export default function GuidePage() {
  

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto flex w-full max-w-[520px] flex-col gap-5">
        <header>
          <h1 className="text-2xl font-black text-gray-900">
            포토 키캡키링 제작 안내
          </h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            사진을 업로드하기 전에 제작 방식을 먼저 확인해주세요.
          </p>
        </header>

        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex h-40 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <div className="text-center">
              <div className="text-4xl font-black">1</div>
              <div className="mt-1 text-sm font-bold">SIZE SELECT</div>
            </div>
          </div>

          <h2 className="text-lg font-black text-gray-900">
            주문한 사이즈를 선택해주세요
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            구매하신 키캡키링 사이즈와 같은 옵션을 선택해야 정확하게 제작됩니다.
          </p>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex h-40 items-center justify-center rounded-2xl bg-purple-50 text-purple-600">
            <div className="text-center">
              <div className="text-4xl font-black">2</div>
              <div className="mt-1 text-sm font-bold">PHOTO UPLOAD</div>
            </div>
          </div>

          <h2 className="text-lg font-black text-gray-900">
            사진을 업로드해주세요
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            얼굴, 반려동물, 로고처럼 중요한 부분이 선명한 사진을 추천합니다.
          </p>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex h-40 items-center justify-center rounded-2xl bg-green-50 text-green-600">
            <div className="text-center">
              <div className="text-4xl font-black">3</div>
              <div className="mt-1 text-sm font-bold">GUIDE AREA</div>
            </div>
          </div>

          <h2 className="text-lg font-black text-gray-900">
            파란 점선 안쪽에 맞춰주세요
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            파란 점선 안쪽이 안전 영역입니다. 중요한 부분이 경계선에 걸리지 않게 배치해주세요.
          </p>
        </section>

        <Link
  href="/photo_editor"
  className="block rounded-2xl bg-blue-600 py-4 text-center text-lg font-black text-white"
>
  확인하고 편집 시작하기
</Link>
      </div>
    </div>
  );
}
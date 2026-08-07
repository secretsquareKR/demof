import Image from 'next/image';
import Link from 'next/link';

const ITEMS = [
  {
    id: 'photo-keycap',
    name: '포토 키캡 키링',
    subtitle: 'PHOTO KEYCAP KEYRING',
    description:
      '좋아하는 사진 한 장을 여러 개의 키캡에 나누어 각인하는 커스텀 키캡 키링입니다.',
    image: '/images/items/photokeycap.webp',
    href: '/editor',
    badge: '사진으로 만들기',
    features: [
      '사진 한 장으로 간편하게 제작',
      '다양한 키캡 배열 선택',
      '키캡 색상 선택 가능',
    ],
  },
  {
    id: 'custom-keycap',
    name: '커스텀 배열 키캡',
    subtitle: 'CUSTOM KEYCAP',
    description:
      '사진과 텍스트를 자유롭게 배치하여 나만의 키캡 배열을 직접 디자인할 수 있습니다.',
    image: '/images/items/custom-keycap.webp',
    href: '/keycapeditor',
    badge: '자유롭게 디자인',
    features: [
      '이미지 여러 장 배치 가능',
      '텍스트 및 글자색 편집',
      '키캡별 자유로운 위치 조정',
    ],
  },
];

export default function ItemsPage() {
  return (
    <main className="min-h-screen bg-[#faf8ff] text-gray-900">
      {/* 상단 */}
      <section className="px-4 pb-8 pt-10 sm:px-6 sm:pb-12 sm:pt-16">
        <div className="mx-auto max-w-6xl text-center">
          <span className="inline-flex rounded-full bg-violet-100 px-4 py-1.5 text-xs font-black tracking-[0.12em] text-violet-600">
            CUSTOM GOODS
          </span>

          <h1 className="mt-5 text-3xl font-black tracking-tight text-purple-950 sm:text-4xl">
            어떤 굿즈를 만들어볼까요?
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-gray-500 sm:text-base sm:leading-7">
            원하는 상품을 선택하면 직접 시안을 만들어볼 수 있습니다.
            <br className="hidden sm:block" />
            사진과 문구를 자유롭게 활용해 나만의 굿즈를 만들어보세요.
          </p>
        </div>
      </section>

      {/* 제품 선택 */}
      <section className="px-4 pb-16 sm:px-6 sm:pb-24">
        <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-2 md:gap-6">
          {ITEMS.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="group overflow-hidden rounded-[28px] border border-purple-100 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-violet-200 hover:shadow-xl hover:shadow-purple-100/70"
            >
              {/* 상품 이미지 */}
              <div className="relative aspect-[4/3] overflow-hidden bg-purple-50">
                <Image
                  src={item.image}
                  alt={item.name}
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover transition duration-500 group-hover:scale-[1.035]"
                />

                <div className="absolute left-4 top-4">
                  <span className="rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-black text-violet-600 shadow-sm backdrop-blur">
                    {item.badge}
                  </span>
                </div>

                {/* hover 느낌 */}
                <div className="absolute inset-0 bg-gradient-to-t from-purple-950/10 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
              </div>

              {/* 상품 정보 */}
              <div className="p-5 sm:p-6">
                <p className="text-[10px] font-black tracking-[0.15em] text-violet-400">
                  {item.subtitle}
                </p>

                <div className="mt-2 flex items-start justify-between gap-4">
                  <h2 className="text-xl font-black text-purple-950 sm:text-2xl">
                    {item.name}
                  </h2>

                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-50 text-lg text-violet-500 transition duration-300 group-hover:bg-violet-500 group-hover:text-white">
                    →
                  </span>
                </div>

                <p className="mt-3 text-sm leading-6 text-gray-500">
                  {item.description}
                </p>

                {/* 특징 */}
                <div className="mt-5 space-y-2">
                  {item.features.map((feature) => (
                    <div
                      key={feature}
                      className="flex items-center gap-2 text-xs font-medium text-gray-600"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-50 text-[10px] font-black text-violet-500">
                        ✓
                      </span>

                      {feature}
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div className="mt-6 flex w-full items-center justify-center rounded-2xl bg-violet-500 px-4 py-3.5 text-sm font-black text-white shadow-md shadow-violet-100 transition group-hover:bg-violet-600">
                  이 상품으로 시안 만들기
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 하단 설명 */}
      <section className="border-y border-purple-100 bg-white px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <p className="text-xs font-black tracking-[0.12em] text-violet-500">
              HOW IT WORKS
            </p>

            <h2 className="mt-2 text-xl font-black text-purple-950">
              직접 디자인하고 주문해보세요
            </h2>
          </div>

          <div className="mt-7 grid grid-cols-3 gap-2 sm:gap-5">
            {[
              {
                number: '01',
                title: '상품 선택',
                description: '만들고 싶은 굿즈를 선택합니다.',
              },
              {
                number: '02',
                title: '시안 제작',
                description: '사진과 문구를 직접 배치합니다.',
              },
              {
                number: '03',
                title: '주문 완료',
                description: '시안 접수 후 스토어에서 주문합니다.',
              },
            ].map((step) => (
              <div
                key={step.number}
                className="rounded-2xl bg-[#faf8ff] p-3 text-center sm:p-5"
              >
                <span className="text-xs font-black text-violet-400">
                  {step.number}
                </span>

                <p className="mt-2 text-sm font-black text-purple-950">
                  {step.title}
                </p>

                <p className="mt-1 hidden text-xs leading-5 text-gray-500 sm:block">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

    </main>
  );
}
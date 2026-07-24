import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";

type MenuCardProps = {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  variant?: "primary" | "purple" | "pink" | "orange";
};

function ArrowIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M9 18L15 12L9 6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShoppingBagIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6.5 8.5H17.5L19 20H5L6.5 8.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9 9V6.5C9 4.57 10.34 3 12 3C13.66 3 15 4.57 15 6.5V9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CustomizeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 17.5V20H6.5L18.8 7.7L16.3 5.2L4 17.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M14.8 6.7L17.3 9.2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M14 19H20"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function RewardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="3.5"
        y="7.5"
        width="17"
        height="13"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M12 7.5V20.5M3.5 12H20.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M12 7.5H8.8C7.25 7.5 6 6.49 6 5.25C6 4.01 7 3 8.25 3C10.25 3 12 7.5 12 7.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M12 7.5H15.2C16.75 7.5 18 6.49 18 5.25C18 4.01 17 3 15.75 3C13.75 3 12 7.5 12 7.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 6.5C4 5.4 4.9 4.5 6 4.5H17C18.1 4.5 19 5.4 19 6.5V8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <rect
        x="3.5"
        y="7.5"
        width="17"
        height="12"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M16 12H20.5V16H16C14.9 16 14 15.1 14 14C14 12.9 14.9 12 16 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2L13.4 7.1C13.8 8.5 14.9 9.6 16.3 10L21 11.3L16.3 12.6C14.9 13 13.8 14.1 13.4 15.5L12 21L10.6 15.5C10.2 14.1 9.1 13 7.7 12.6L3 11.3L7.7 10C9.1 9.6 10.2 8.5 10.6 7.1L12 2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function MenuCard({
  href,
  icon,
  title,
  description,
  variant = "primary",
}: MenuCardProps) {
  return (
    <Link
      href={href}
      className={`${styles.menuCard} ${styles[variant]}`}
    >
      <div className={styles.menuIcon}>{icon}</div>

      <div className={styles.menuContent}>
        <strong>{title}</strong>
        <span>{description}</span>
      </div>

      <div className={styles.menuArrow}>
        <ArrowIcon />
      </div>
    </Link>
  );
}

export default function HomePage() {
  return (
    <main className={styles.page}>
      
      <div className={styles.container}>
        <div className={styles.looImage}>
        <Link href="/" >
            <Image
            src="/images/dimof-logo.png"
            alt="디모프 로고"
            width={100}
            height={30}
            priority
          />
        </Link>
      </div>
        {/* <header className={styles.header}> */}
          {/* <Link href="/" className={styles.logoArea}>
            <Image
            src="/images/dimof-logo.png"
            alt="디모프 로고"
            width={110}
            height={36}
            className={styles.logoImage}
            priority
          />
          </Link>

          {/* <Link href="/login" className={styles.loginButton}>
            로그인
          </Link> */}
        {/* </header> */}
        
        
          <br></br>
        <section className={styles.hero}>
          
          <div className={styles.heroGlowOne} />
          <div className={styles.heroGlowTwo} />

          <div className={styles.heroContents}>
            <span className={styles.heroBadge}>
              <span className={styles.sparkle}>
                <SparkleIcon />
              </span>
              나만의 굿즈를 만드는 즐거움
            </span>

            <h1>
              소중한 순간을
              <br />
              <span>특별한 굿즈</span>로 만들어보세요
            </h1>

            <p>
              사진과 문구를 자유롭게 꾸미고
              <br />
              세상에 하나뿐인 굿즈를 제작해보세요.
            </p>

            <Link href="/custom" className={styles.heroButton}>
              굿즈 주문제작 시작하기
              <ArrowIcon />
            </Link>
          </div>

          <div className={styles.heroVisual} aria-hidden="true">
            <div className={styles.productCardBack} />
            <div className={styles.productCard}>
              <div className={styles.keycapGrid}>
                <span>D</span>
                <span>I</span>
                <span>M</span>
                <span>O</span>
                <span>F</span>
                <span>♥</span>
              </div>
              <div className={styles.keyringCircle} />
            </div>
          </div>
        </section>

        <section className={styles.menuSection}>
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.sectionEyebrow}>QUICK MENU</span>
              <h2>무엇을 도와드릴까요?</h2>
            </div>
          </div>

          <div className={styles.menuList}>
            <MenuCard
              href="/goods"
              variant="primary"
              icon={<ShoppingBagIcon />}
              title="굿즈 둘러보기"
              description="디모프의 다양한 굿즈를 만나보세요"
            />

            <MenuCard
              href="/custom"
              variant="purple"
              icon={<CustomizeIcon />}
              title="굿즈 주문제작 하러가기"
              description="사진과 문구로 나만의 굿즈를 만들어보세요"
            />

            <MenuCard
              href="/influencer/apply"
              variant="pink"
              icon={<RewardIcon />}
              title="리워드 코드 신청하기"
              description="나만의 추천 코드를 만들고 리워드를 받아보세요"
            />

            <MenuCard
              href="/influencer/dashboard"
              variant="orange"
              icon={<WalletIcon />}
              title="리워드 확인하기"
              description="적립 금액과 리워드 변동 내역을 확인하세요"
            />
          </div>
        </section>

        <section className={styles.rewardBanner}>
          <div className={styles.rewardBannerIcon}>
            <RewardIcon />
          </div>

          <div className={styles.rewardBannerText}>
            <span>DIMOF REWARD</span>
            <strong>친구가 구매하면 결제금액의 10% 적립</strong>
            <p>추천 코드를 공유하고 리워드 혜택을 받아보세요.</p>
          </div>

          <Link href="/influencer/apply" className={styles.bannerArrow}>
            <ArrowIcon />
          </Link>
        </section>

        <section className={styles.guideSection}>
          <div className={styles.guideTop}>
            <div>
              <span className={styles.sectionEyebrow}>HOW TO ORDER</span>
              <h2>주문제작은 이렇게 진행돼요</h2>
            </div>
          </div>

          <div className={styles.steps}>
            <div className={styles.step}>
              <span>01</span>
              <div>
                <strong>상품 선택</strong>
                <p>원하는 상품과 사이즈를 선택합니다.</p>
              </div>
            </div>

            <div className={styles.stepDivider} />

            <div className={styles.step}>
              <span>02</span>
              <div>
                <strong>사진 꾸미기</strong>
                <p>사진과 문구를 자유롭게 배치합니다.</p>
              </div>
            </div>

            <div className={styles.stepDivider} />

            <div className={styles.step}>
              <span>03</span>
              <div>
                <strong>제작 및 배송</strong>
                <p>주문 확인 후 정성스럽게 제작합니다.</p>
              </div>
            </div>
          </div>
        </section>

        <footer className={styles.footer}>
          <div className={styles.footerLogo}>디모프</div>
          <p>일상 속 작은 즐거움을 만드는 커스텀 굿즈 브랜드</p>

          <div className={styles.footerLinks}>
            <Link href="/terms">이용약관</Link>
            <Link href="/privacy">개인정보처리방침</Link>
            <Link href="/support">고객센터</Link>
          </div>

          <span>© 2026 DIMOF. All rights reserved.</span>
        </footer>
      </div>
    </main>
  );
}
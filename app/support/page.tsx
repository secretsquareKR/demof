import Image from "next/image";
import Link from "next/link";
import styles from "./support.module.css";

export default function SupportPage() {
  const emailAddress = "secretsquare@naver.com";

  const emailSubject = encodeURIComponent("[디모프 문의] 주문 및 제작 문의");
  const emailBody = encodeURIComponent(
    [
      "안녕하세요.",
      "",
      "문의 유형:",
      "주문번호:",
      "성함:",
      "연락처:",
      "",
      "문의 내용:",
    ].join("\n")
  );

  const emailLink = `mailto:${emailAddress}?subject=${emailSubject}&body=${emailBody}`;

  return (
    <main className={styles.page}>
      <div className={styles.backgroundCircleOne} />
      <div className={styles.backgroundCircleTwo} />

      <div className={styles.container}>
        <header className={styles.header}>
          <div className="flex justify-start">
        <Link href="/" >
            <Image
            src="/images/dimof-logo.png"
            alt="디모프 로고"
            width={110}
            height={36}
            priority
          />
      </Link>
      
      
      </div>
        </header>

        <section className={styles.hero}>
          <span className={styles.eyebrow}>DIMOF CUSTOMER CENTER</span>

          <div className={styles.heroIcon}>
            <HeadsetIcon />
          </div>

          <h1 className={styles.title}>
            무엇을
            <br />
            도와드릴까요?
          </h1>

          <p className={styles.description}>
            주문, 제작, 배송과 관련된 문의사항은
            <br />
            이메일 또는 네이버 톡톡으로 남겨주세요.
          </p>
        </section>

        <section className={styles.contactSection}>
          <h2 className={styles.sectionTitle}>문의 방법을 선택해주세요</h2>

          <div className={styles.contactList}>
            <a href={emailLink} className={styles.contactCard}>
              <div className={styles.emailIcon}>
                <MailIcon />
              </div>

              <div className={styles.contactContent}>
                <span className={styles.contactLabel}>이메일 문의</span>

                <strong className={styles.contactTitle}>
                  {emailAddress}
                </strong>

                <p className={styles.contactDescription}>
                  문의 내용을 작성해 보내주시면 확인 후 답변드려요.
                </p>
              </div>

              <span className={styles.arrowButton}>
                <ArrowIcon />
              </span>
            </a>

            <a
              href="https://talk.naver.com/ct/w4lz5m?frm=psf"
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.contactCard} ${styles.talkCard}`}
            >
              <div className={styles.talkIcon}>
                <TalkIcon />
              </div>

              <div className={styles.contactContent}>
                <span className={styles.contactLabel}>빠른 문의</span>

                <strong className={styles.contactTitle}>
                  네이버 톡톡 문의하기
                </strong>

                <p className={styles.contactDescription}>
                  주문번호와 함께 문의하면 더 빠르게 확인할 수 있어요.
                </p>
              </div>

              <span
                className={`${styles.arrowButton} ${styles.talkArrow}`}
              >
                <ArrowIcon />
              </span>
            </a>
          </div>
        </section>

        <section className={styles.companySection}>
          <div className={styles.companyHeading}>
            <div>
              <span className={styles.smallLabel}>COMPANY INFORMATION</span>
              <h2>회사 정보</h2>
            </div>

            <span className={styles.companyBadge}>DIMOF</span>
          </div>

          <dl className={styles.companyInfo}>
            <div className={styles.companyRow}>
              <dt>상호명</dt>
              <dd>시크릿스퀘어</dd>
            </div>

            <div className={styles.companyRow}>
              <dt>브랜드</dt>
              <dd>디모프</dd>
            </div>

            <div className={styles.companyRow}>
              <dt>대표자</dt>
              <dd>고진형</dd>
            </div>

            <div className={styles.companyRow}>
              <dt>문의 이메일</dt>
              <dd>
                <a href={emailLink}>{emailAddress}</a>
              </dd>
            </div>

            <div className={styles.companyRow}>
              <dt>문의 가능 시간</dt>
              <dd>평일 10:00 ~ 18:00</dd>
            </div>
          </dl>
        </section>

        <section className={styles.noticeBox}>
          <div className={styles.noticeIcon}>!</div>

          <div>
            <strong>문의 전 확인해주세요</strong>
            <p>
              주문 관련 문의 시 주문번호와 주문자명을 함께 남겨주시면
              더욱 빠르게 확인할 수 있습니다.
            </p>
            <p>
              주말 및 공휴일에 접수된 문의는 다음 영업일부터 순차적으로
              답변드립니다.
            </p>
          </div>
        </section>

        <footer className={styles.footer}>
          <span>DIMOF CUSTOMER CENTER</span>
          <p>소중한 문의에 정성껏 답변드리겠습니다.</p>
        </footer>
      </div>
    </main>
  );
}

function HeadsetIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 13v-1a8 8 0 0 1 16 0v5a3 3 0 0 1-3 3h-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M4 12h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H4v-6ZM20 12h-2a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2v-6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="m5 8 7 5 7-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TalkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 4c5 0 9 3.1 9 7s-4 7-9 7c-.8 0-1.6-.1-2.3-.2L5 20l1.4-3.4C4.3 15.3 3 13.3 3 11c0-3.9 4-7 9-7Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 11h8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m9 6 6 6-6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
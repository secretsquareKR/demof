import Link from 'next/link';
import styles from "../page.module.css";


export default function Footer() {
  return (
    <footer className="mt-16 border-t border-purple-100 bg-white">



      <div className="mx-auto max-w-6xl px-4 py-8 text-center">
        <p className="text-sm font-black text-purple-950">
            <a href="https://www.dimofstudio.com/"
            className="transition hover:text-purple-700">
                DIMOF
            </a>
          
        </p>

              <p className="text-xs font-black "> 일상 속 작은 즐거움을 만드는 커스텀 굿즈 브랜드</p>
          <br></br>
          <div className={styles.footerLinks}>
            {/* <Link href="/terms">이용약관</Link>
            <Link href="/privacy">개인정보처리방침</Link> */}
            <Link href="/support" >고객센터</Link>
          </div>


        {/* <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-gray-500">
          <a
            href="/terms"
            className="transition hover:text-purple-700"
          >
            이용약관
          </a>

          <a
            href="/privacy"
            className="font-bold transition hover:text-purple-700"
          >
            개인정보처리방침
          </a>

          <a
            href="https://www.dimofstudio.com/editor"
            className="transition hover:text-purple-700"
          >
            홈페이지
          </a>
        </div> */}

        <p className="mt-5 text-[11px] text-gray-300">
          © {new Date().getFullYear()} DIMOF. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
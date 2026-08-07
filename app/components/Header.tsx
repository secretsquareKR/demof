
import Image from "next/image";
import Link from 'next/link';
import styles from "../page.module.css";

export default function Header() {
  return (
    <header className={styles.header}>

      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 " >
        {/* 로고 */}

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
      

      </div>
    </header>
  );
}
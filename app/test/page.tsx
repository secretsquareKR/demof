// src/app/test/page.tsx
import { redirect } from 'next/navigation';

export default function TestPage() {
  // 1. 백엔드(서버)에서 실행될 함수 (Server Action)
  async function createServerAction(formData: FormData) {
    'use server'; // 이 지시어가 있으면 이 함수는 무조건 백엔드(서버)에서만 실행됩니다.

    const username = formData.get('username');

    // 2. 백엔드 터미널(VS Code 터미널)에서 입력된 이름 확인
    console.log(`[BACKEND] 유저가 입력한 이름: ${username}`);

    // 여기에 DB 저장 등 필요한 백엔드 로직을 추가할 수 있습니다.

    // 3. 홈 화면('/')으로 이동
    redirect('/');
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>이름을 입력해주세요</h1>
        
        {/* form의 action에 서버 함수를 직접 연결합니다 */}
        <form action={createServerAction} style={styles.form}>
          <input
            type="text"
            name="username" // 백엔드에서 formData.get('username')으로 꺼낼 이름입니다.
            placeholder="이름 입력"
            required
            style={styles.input}
          />
          <button type="submit" style={styles.button}>
            제출하고 홈으로 이동
          </button>
        </form>
      </div>
    </div>
  );
}

// 간단한 스타일링
const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: '#f5f5f5',
  },
  card: {
    padding: '40px',
    borderRadius: '8px',
    backgroundColor: '#fff',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    textAlign: 'center' as const,
  },
  title: {
    marginBottom: '20px',
    fontSize: '24px',
    color: '#333',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  input: {
    padding: '10px',
    fontSize: '16px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    width: '250px',
  },
  button: {
    padding: '10px',
    fontSize: '16px',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: '#0070f3',
    color: '#fff',
    cursor: 'pointer',
  },
};
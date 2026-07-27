'use client';

import { supabase } from '@/app/lib/supabase';
import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useState } from 'react'; // 💡 useEffect 추가

interface RewardLog {
  id: string;
  order_id: string | null;
  amount: number;
  type: 'EARNED' | 'WITHDRAWN';
  order_status: 'PENDING' | 'PAID' |'COMPLETED' |'CANCELLED';
  description: string | null;
  created_at: string;
}

//PENDING 시안접수
//PAID   결제확인
//COMPLETED 리워드 확정
//CANCELLED 주문취소






interface RewardVisual {
  imageSrc: string;
  imageAlt: string;
  title: string;
  description: string;
  badge: string;
}


export default function InfluencerDashboard() {
  const [loginForm, setLoginForm] = useState({ name: '', phone: '' });
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [influencerInfo, setInfluencerInfo] = useState<{ id: string; name: string; referralCode: string } | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  //const [summary, setSummary] = useState({ pendingAmount: 0, totalEarned: 0, totalWithdrawn: 0, currentBalance: 0 });
  const [summary, setSummary] = useState({ designPendingAmount: 0, paidPendingAmount: 0, availableAmount: 0, totalWithdrawn: 0, currentBalance: 0 });
  const [logs, setLogs] = useState<RewardLog[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);






  

   // 💡 [추가] 2. 로그인 성공 데이터를 바탕으로 Supabase에서 적립금 정보를 긁어오는 함수 분리
  const loadRewardData = async (influencers: { id: string; name: string; referralCode: string }) => {
    try {
      setIsLoading(true);
      const { data: rewardLogs, error: logError } = await supabase
        .from('reward_logs')
        .select('*')
        .eq('influencer_id', influencers.id)
        .order('created_at', { ascending: false });

      if (logError) throw logError;

      // let pending = 0;
      // let earned = 0;
      // let withdrawn = 0;
      let designPending = 0;
      let paidPending = 0;
      let completed = 0;
      let withdrawn = 0;


      const rawLogs: RewardLog[] = rewardLogs || [];

      rawLogs.forEach((log) => {
          if (log.type === "EARNED") {

              switch (log.order_status) {

                  case "PENDING":
                      designPending += Number(log.amount);
                      break;

                  case "PAID":
                      paidPending += Number(log.amount);
                      break;

                  case "COMPLETED":
                      completed += Number(log.amount);
                      break;
              }

          } else if (log.type === "WITHDRAWN") {
              withdrawn += Number(log.amount);
          }
      });

      setInfluencerInfo(influencers);
      // setSummary({ pendingAmount: pending, totalEarned: earned, totalWithdrawn: withdrawn, currentBalance: earned - withdrawn });
      setSummary({
          designPendingAmount: designPending,
          paidPendingAmount: paidPending,
          availableAmount: completed,
          totalWithdrawn: withdrawn,
          currentBalance: completed - withdrawn
      });
      setLogs(rawLogs);
      setIsLoggedIn(true);
    } catch (e) {
      console.error('데이터 로드 에러:', e);
      setErrorMessage('세션 연동 중 오류가 발생했습니다.');
    } finally {
        setIsLoading(false);
        setIsInitialLoading(false); // 💡 최초 로딩 완료 표시
  }
  };
  
  // 💡 [추가] 1. 컴포넌트 마운트 시 브라우저 로컬스토리지에 로그인 이력이 있는지 체크
// useEffect 내부의 모든 동기적 setState 호출을 완벽히 격리
  useEffect(() => {
    const savedInfo = localStorage.getItem('dimof_influencer_session');
    
    // 세션이 있든 없든, 상태 변경(setState)을 동기적으로 즉시 실행하지 않고
    // React의 첫 렌더링 사이클이 완전히 끝난 직후 비동기로 실행되도록 제어합니다.
    setTimeout(() => {
      if (savedInfo) {
        const parsedInfo = JSON.parse(savedInfo);
        loadRewardData(parsedInfo);
      } else {
        setIsInitialLoading(false); // 세션이 없을 때의 상태 변경도 안전하게 뒤로 미룸
      }
    }, 0);
  }, []);

 

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      setLoginForm({ ...loginForm, [name]: value.replace(/[^0-9]/g, '') });
    } else {
      setLoginForm({ ...loginForm, [name]: value });
    }
  };

  // 조회(로그인) 처리
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const { data: influencer, error: infError } = await supabase
        .from('influencers')
        .select('id, name, referral_code, status')
        .eq('name', loginForm.name)
        .eq('phone', loginForm.phone)
        .maybeSingle();

      if (infError) throw infError;

      if (!influencer) {
        setErrorMessage('등록되지 않은 정보이거나 일치하는 내역이 없습니다.');
        setIsLoading(false);
        return;
      }

      if (influencer.status === 'PENDING') {
        setErrorMessage('현재 승인 심사 대기 중인 인플루언서입니다.');
        setIsLoading(false);
        return;
      }

      if (influencer.status === 'REJECTED') {
        setErrorMessage('신청이 반려된 계정입니다. 고객센터로 문의해 주세요.');
        setIsLoading(false);
        return;
      }

      const sessionData = { id: influencer.id, name: influencer.name, referralCode: influencer.referral_code };
      
      // 💡 [추가] 로그인 성공 시 로컬스토리지에 정보 영구 저장
      localStorage.setItem('dimof_influencer_session', JSON.stringify(sessionData));
      
      // 데이터 로드 실행
      await loadRewardData(sessionData);

    } catch (error) {
      console.error('대시보드 조회 에러:', error);
      setErrorMessage('조회 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 로그아웃
  const handleLogout = () => {
    // 💡 [추가] 로그아웃 시 로컬스토리지에 있는 키 정보 완전히 삭제
    localStorage.removeItem('dimof_influencer_session');
    setIsLoggedIn(false);
    setInfluencerInfo(null);
    setLoginForm({ name: '', phone: '' });
  };

  const getRewardVisual = (): RewardVisual => {
  const completedEarnedLogs = logs.filter(
    (log) =>
      log.type === 'EARNED' &&
      log.order_status === 'COMPLETED'
  );
  const pendingLogs = logs.filter(
      log =>
          log.type === "EARNED" &&
          log.order_status === "PENDING"
  );

  const paidLogs = logs.filter(
      log =>
          log.type === "EARNED" &&
          log.order_status === "PAID"
  );

  const hasAnyRewardHistory =
    summary.availableAmount > 0 ||
    summary.totalWithdrawn > 0 ||
    summary.designPendingAmount > 0;

  const hasWithdrawnAll =
    summary.totalWithdrawn > 0 &&
    summary.currentBalance <= 0 &&
    summary.designPendingAmount <= 0;

  //리워드 코드로 처음 시안접수가 발생한 경우
  if (
    pendingLogs.length > 0 &&
    completedEarnedLogs.length === 0 &&
    paidLogs.length === 0
  ) {
      return {
          imageSrc: "/images/reward/reward-use-code.jpg",
          imageAlt: "리워드 코드가 처음 사용된 고양이",
          badge: "첫 사용!",
          title: "리워드 코드가 사용되었어요!",
          description:
              "고객이 시안을 접수했습니다. 주문이 완료되면 리워드가 적립됩니다."
      };
  }

  // 5. 과거에 적립금이 있었지만 전부 인출한 경우
  if (hasWithdrawnAll) {
    return {
      imageSrc: '/images/reward/reward-empty.jpg',
      imageAlt: '리워드를 모두 인출해 텅장이 된 고양이',
      badge: '텅장이 되었어요',
      title: '리워드를 모두 인출했어요',
      description: '다시 홍보를 시작하고 새로운 리워드를 모아보세요.',
    };
  }

  // 1. 적립 및 결제 대기 내역이 전혀 없는 경우
  if (!hasAnyRewardHistory) {
    return {
      imageSrc: '/images/reward/reward-start.jpg',
      imageAlt: '아직 리워드 적립을 시작하지 않은 고양이',
      badge: '아직 출발 전이에요',
      title: '첫 리워드를 기다리고 있어요',
      description: '리워드 코드를 공유하면 결제금액의 10%가 적립됩니다.',
    };
  }

  // 4. 현재 사용할 수 있는 보유 잔액이 30,000원 이상인 경우
  if (summary.currentBalance >= 30000) {
    return {
      imageSrc: '/images/reward/reward-rich.jpg',
      imageAlt: '리워드가 많이 쌓여 부자가 된 고양이',
      badge: 'FLEX',
      title: '리워드가 많이 모였어요',
      description: '꾸준한 홍보 덕분에 리워드가 풍성하게 쌓였습니다.',
    };
  }

  // 2. 완료된 첫 적립 내역이 딱 한 건인 경우
  if (
    completedEarnedLogs.length === 1 &&
    summary.currentBalance > 0
  ) {
    return {
      imageSrc: '/images/reward/reward-first.jpg',
      imageAlt: '첫 수익이 생겨 기뻐하는 고양이',
      badge: '첫 수익이 생겼어요',
      title: '첫 리워드 적립을 축하해요',
      description: '첫 주문이 완료되어 사용할 수 있는 리워드가 생겼습니다.',
    };
  }

  // 3. 적립 내역이 여러 건이거나 결제 대기 금액이 존재하는 경우
  return {
    imageSrc: '/images/reward/reward-growing.jpg',
    imageAlt: '리워드 동전이 계속 쌓이고 있는 고양이',
    badge: '열심히 홍보 중..!',
    title: '리워드가 차곡차곡 쌓이고 있어요',
    description:
      summary.designPendingAmount > 0
        ? `${summary.designPendingAmount.toLocaleString()}원의 리워드가 결제 완료를 기다리고 있습니다.`
        : '꾸준한 코드 공유로 리워드가 계속 적립되고 있습니다.',
  };
};




















  

  if (isInitialLoading) {
    
  return (
    <div className="min-h-screen bg-[#F8F9FD] flex items-center justify-center">
      <span className="text-[#7C3AED] font-semibold animate-pulse">잠시만 기다려주세요...</span>
    </div>
  );
}
  const rewardVisual = isLoggedIn ? getRewardVisual() : null;
  return (

    <div className="min-h-screen bg-[#F8F9FD] flex flex-col items-center justify-start px-4 py-8 text-[#333333]">
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
      <br>
      </br>
      
      </div>
      
      
      {/* 1. 비로그인 상태 */}
      {!isLoggedIn ? (
        <div className="w-full max-w-md flex flex-col gap-6 mt-12">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-[#000000]">인플루언서 리워드 조회</h1>
            <p className="text-sm text-[#A78BFA] mt-1">이름과 연락처를 입력하여 적립금을 확인하세요.</p>
          </div>

          <form onSubmit={handleLoginSubmit} className="bg-white border border-[#EDE9FE] rounded-3xl p-6 shadow-sm flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-[#000000] px-1">이름</label>
              <input
                type="text"
                name="name"
                required
                value={loginForm.name}
                onChange={handleInputChange}
                placeholder="홍길동"
                className="w-full px-4 py-3 border border-[#E9E3FF] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#C084FC] focus:border-transparent transition-all placeholder:text-[#aaaaaa]"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-[#000000] px-1">연락처</label>
              <input
                type="tel"
                name="phone"
                required
                value={loginForm.phone}
                onChange={handleInputChange}
                placeholder="숫자만 입력 (예: 01000000000)"
                className="w-full px-4 py-3 border border-[#E9E3FF] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#C084FC] focus:border-transparent transition-all placeholder:text-[#aaaaaa]"
              />
            </div>

            {errorMessage && <p className="text-xs font-medium text-red-500 px-1">{errorMessage}</p>}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-[#7C3AED] hover:bg-[#6D28D9] text-white  font-semibold rounded-2xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center mt-2 disabled:bg-gray-400"
            >
              {isLoading ? '조회 중...' : '적립금 조회하기'}
            </button>
          </form>
        </div>
      ) : (
        /* 2. 로그인 상태 (대시보드) */
        
        
        <div className="w-full max-w-lg flex flex-col gap-6">
          <br>
      </br>
      
          <div className="w-full flex justify-between items-center bg-white border border-[#EDE9FE] rounded-2xl px-5 py-4 shadow-sm">
            <div>
              <span className="text-lg font-bold text-[#4C1D95]">{influencerInfo?.name}</span>
              <span className="text-xs font-semibold bg-[#F5F3FF] text-[#7C3AED] ml-2 px-2 py-0.5 rounded-full font-mono">
                {influencerInfo?.referralCode}
              </span>
            </div>
            <button onClick={handleLogout} className="text-xs text-[#A78BFA] hover:text-[#7C3AED] underline transition-all">
              로그아웃
            </button>
          </div>

          {rewardVisual && (
            <section className="relative overflow-hidden bg-white border border-[#EDE9FE] rounded-3xl shadow-sm">
              <div className="absolute top-0 left-0 w-32 h-32 bg-[#F3E8FF] rounded-full blur-3xl opacity-70 -translate-x-1/2 -translate-y-1/2" />

              <div className="absolute bottom-0 right-0 w-36 h-36 bg-[#FCE7F3] rounded-full blur-3xl opacity-50 translate-x-1/2 translate-y-1/2" />

              <div className="relative px-5 pt-5">
                <span className="inline-flex items-center rounded-full bg-[#F5F3FF] px-3 py-1.5 text-[11px] font-bold text-[#7C3AED]">
                  {rewardVisual.badge}
                </span>

                <h2 className="mt-3 text-xl font-black tracking-[-0.04em] text-[#2D2140]">
                  {rewardVisual.title}
                </h2>

                <p className="mt-1.5 text-xs leading-5 text-[#8D8797]">
                  {rewardVisual.description}
                </p>
              </div>

              <div className="relative mt-2 w-full aspect-[4/3]">
                <Image
                  src={rewardVisual.imageSrc}
                  alt={rewardVisual.imageAlt}
                  fill
                  sizes="(max-width: 640px) 100vw, 512px"
                  className="object-contain"
                  priority
                />
              </div>
            </section>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-[#EDE9FE] rounded-2xl p-4 shadow-sm flex flex-col gap-1 col-span-2">
              <span className="text-xs font-medium text-[#7C3AED]">현재 보유 잔액 (정산 완료)</span>
              <span className="text-2xl font-black text-[#5B21B6]">{summary.currentBalance.toLocaleString()} 원</span>
            </div>

            <div className="bg-[#FAF5FF] border border-[#F3E8FF] rounded-2xl p-4 flex flex-col gap-1">
              <span className="text-xs font-medium text-[#8B5CF6]">시안접수 후 결제 대기</span>
              <span className="text-lg font-bold text-[#7C3AED]">{summary.designPendingAmount.toLocaleString()} 원</span>
            </div>

            <div className="bg-white border border-[#EDE9FE] rounded-2xl p-4 shadow-sm flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-400">지급 완료 (차감액)</span>
              <span className="text-lg font-bold text-gray-500">{summary.totalWithdrawn.toLocaleString()} 원</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-bold text-[#4C1D95] px-1">리워드 변동 내역</h3>
            <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-1">
              {logs.length === 0 ? (
                <div className="text-center py-12 bg-white border border-[#EDE9FE] rounded-2xl text-xs text-gray-400">
                  아직 발생한 리워드 내역이 없습니다.
                </div>
              ) : (
                logs.map((log) => {
                  const isEarned = log.type === 'EARNED';
                  const isPending = log.order_status === 'PENDING';

                  return (
                    <div key={log.id} className="bg-white border border-[#EDE9FE] rounded-2xl p-4 shadow-sm flex justify-between items-center transition-all hover:border-[#C084FC]">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-gray-400">
                          {new Date(log.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                        </span>
                        <span className="text-sm font-medium text-[#333333]">
                          {log.description || (isEarned ? '굿즈 판매 적립' : '리워드 정산 지급')}
                        </span>
                        {isEarned && (
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full w-max ${isPending ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            {isPending ? '결제대기' : '적립확정'}
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className={`text-base font-bold ${isEarned ? (isPending ? 'text-amber-500' : 'text-[#7C3AED]') : 'text-gray-500'}`}>
                          {isEarned ? '+' : '-'}{Number(log.amount).toLocaleString()} 원
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
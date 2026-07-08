'use client';

import { supabase } from '@/app/lib/supabase';

import React, { useState } from 'react';
// ⚠️ 기존 프로젝트의 supabaseClient가 위치한 경로로 매칭해주세요.


export default function InfluencerApplyPage() {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    snsChannel: '',
    referralCode: '',
  });
  const [isAgreed, setIsAgreed] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false); // [추가] 등록 중 로딩 상태 관리

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name === 'phone') {
      const onlyNumbers = value.replace(/[^0-9]/g, '');
      setFormData({ ...formData, [name]: onlyNumbers });
    } else if (name === 'referralCode') {
      const cleanCode = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      setFormData({ ...formData, [name]: cleanCode });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    // 1. 유효성 검증
    const codeRegex = /^[A-Z0-9]{4,8}$/;
    if (!codeRegex.test(formData.referralCode)) {
      setErrorMessage('인플루언서 코드는 영문 대문자와 숫자 조합의 4~8글자여야 합니다.');
      return;
    }

    if (!isAgreed) {
      setErrorMessage('개인정보 수집 및 이용에 동의해 주세요.');
      return;
    }

    // 2. Supabase 등록 프로세스 시작
    setIsLoading(true);

    try {
      // [중복 체크] 입력한 인플루언서 코드가 이미 DB에 존재하는지 확인
      const { data: existingCode, error: checkError } = await supabase
        .from('influencers')
        .select('referral_code')
        .eq('referral_code', formData.referralCode)
        .maybeSingle(); // 결과가 없어도 에러를 내지 않고 null 반환

      if (checkError) throw checkError;

      if (existingCode) {
        setErrorMessage('이미 사용 중이거나 신청된 인플루언서 코드입니다. 다른 코드를 입력해주세요.');
        setIsLoading(false);
        return;
      }

      // [데이터 삽입] DB 테이블에 인플루언서 신청 내역 Insert
      const { error: insertError } = await supabase
        .from('influencers')
        .insert([
          {
            name: formData.name,
            phone: formData.phone,
            sns_channel: formData.snsChannel,
            referral_code: formData.referralCode,
            status: 'PENDING' // 명시적으로 대기 상태 지정
          }
        ]);

      if (insertError) throw insertError;

      // 성공 시 알림 및 폼 초기화
      alert('인플루언서 리워드 신청이 완료되었습니다! 검토 후 승인까지 시일이 소요될 수 있습니다.');
      setFormData({ name: '', phone: '', snsChannel: '', referralCode: '' });
      setIsAgreed(false);

    } catch (error: unknown) { // any 대신 unknown 사용
      console.error('인플루언서 등록 에러:', error);
      
      // error가 인스턴스 Error 객체인지 확인 후 메시지 추출
      if (error instanceof Error) {
        setErrorMessage(`신청 처리 중 오류가 발생했습니다: ${error.message}`);
      } else {
        setErrorMessage('신청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FD] flex flex-col items-center justify-start px-4 py-8 text-[#333333]">
      
      {/* 헤더 섹션 */}
      <div className="w-full max-w-md text-left mb-6 px-1">
        <h1 className="text-2xl font-bold text-[#5B21B6]">인플루언서 리워드 신청</h1>
        <p className="text-sm text-[#A78BFA] mt-1">
          인플루언서코드를 입력해서 주문한 제품 가격의 10%를 적립해드립니다.
        </p>
      </div>

      {/* 메인 신청 폼 카드 */}
      <form 
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white border border-[#EDE9FE] rounded-3xl p-6 shadow-sm flex flex-col gap-6"
      >
        <div className="flex justify-between items-center border-b border-[#F5F3FF] pb-3">
          <span className="text-base font-semibold text-[#6D28D9]">신청자 정보 입력</span>
          <span className="text-xs bg-[#F5F3FF] text-[#7C3AED] px-2 py-1 rounded-full font-medium">Step 1</span>
        </div>

        {/* 이름 입력 (최대 15자) */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-[#4C1D95] px-1">이름</label>
          <input
            type="text"
            name="name"
            maxLength={15}
            required
            disabled={isLoading}
            value={formData.name}
            onChange={handleChange}
            placeholder="홍길동 (최대 15자)"
            className="w-full px-4 py-3 border border-[#E9E3FF] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#C084FC] focus:border-transparent transition-all placeholder:text-[#C4B5FD] disabled:bg-gray-50"
          />
        </div>

        {/* 연락처 입력 (숫자만 가능) */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-[#4C1D95] px-1">연락처</label>
          <input
            type="tel"
            name="phone"
            required
            disabled={isLoading}
            value={formData.phone}
            onChange={handleChange}
            placeholder="숫자만 입력해 주세요 (예: 01000000000)"
            className="w-full px-4 py-3 border border-[#E9E3FF] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#C084FC] focus:border-transparent transition-all placeholder:text-[#C4B5FD] disabled:bg-gray-50"
          />
        </div>

        {/* SNS 채널 링크 입력 */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-[#4C1D95] px-1">SNS 채널 주소</label>
          <input
            name="snsChannel"
            required
            disabled={isLoading}
            value={formData.snsChannel}
            onChange={handleChange}
            placeholder="https://instagram.com/your_id"
            className="w-full px-4 py-3 border border-[#E9E3FF] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#C084FC] focus:border-transparent transition-all placeholder:text-[#C4B5FD] disabled:bg-gray-50"
          />
        </div>

        {/* 희망 인플루언서 코드 입력 (4~8자) */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center px-1">
            <label className="text-sm font-semibold text-[#4C1D95]">희망 인플루언서 코드</label>
            <span className="text-xs text-[#A78BFA]">영문/숫자 4~8자리</span>
          </div>
          <input
            type="text"
            name="referralCode"
            maxLength={8}
            required
            disabled={isLoading}
            value={formData.referralCode}
            onChange={handleChange}
            placeholder="예: GOODSHOP"
            className="w-full px-4 py-3 border border-[#E9E3FF] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#C084FC] focus:border-transparent transition-all placeholder:text-[#C4B5FD] tracking-wider font-mono disabled:bg-gray-50"
          />
        </div>

        {/* 개인정보 수집 및 이용 동의 체크박스 */}
        <div className="flex items-start gap-3 px-1 py-1 select-none">
          <input
            type="checkbox"
            id="privacyAgreement"
            disabled={isLoading}
            checked={isAgreed}
            onChange={(e) => setIsAgreed(e.target.checked)}
            className="w-5 h-5 rounded-md border-[#E9E3FF] text-[#7C3AED] focus:ring-[#C084FC] transition-all accent-[#7C3AED] mt-0.5 cursor-pointer disabled:opacity-50"
          />
          <label htmlFor="privacyAgreement" className="text-xs text-[#4C1D95] font-medium leading-relaxed cursor-pointer">
            <span className="text-[#7C3AED] font-bold">[필수]</span> 개인정보 수집 및 이용 동의
            <p className="text-[#9333EA] font-normal text-[11px] mt-0.5">
              수집 목적: 인플루언서 리워드 정산 및 본인 확인<br />
              수집 항목: 이름, 연락처, SNS 채널 주소
            </p>
          </label>
        </div>

        {/* 에러 메시지 출력 */}
        {errorMessage && (
          <p className="text-xs font-medium text-red-500 px-1 -mt-2">{errorMessage}</p>
        )}

        {/* 안내 문구 */}
        <div className="bg-[#FAF5FF] rounded-2xl p-4 border border-[#F3E8FF] text-xs text-[#7C3AED] leading-relaxed">
          <p className="font-semibold mb-1">📢 필독 및 안내사항</p>
          <ul className="list-disc list-inside space-y-1 text-[#8B5CF6]">
            <li>제출하신 인플루언서 코드는 중복 검사 및 내부 검토 후 최종 승인됩니다.</li>
            <li>부적절한 단어나 타 브랜드를 사칭하는 코드는 반려될 수 있습니다.</li>
            <li>포인트 정산 및 내역 조사는 입력하신 이름과 연락처를 통해 진행됩니다.</li>
          </ul>
        </div>

        {/* 신청하기 버튼 */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-4 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-semibold rounded-2xl shadow-md transition-all active:scale-[0.98] mt-2 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isLoading ? (
            <span className="animate-pulse">신청 처리 중...</span>
          ) : (
            '리워드 신청하기'
          )}
        </button>
      </form>
    </div>
  );
}
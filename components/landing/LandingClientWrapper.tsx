'use client';

import React, { useState } from 'react';
import { LandingRegistrationForm, LandingRegistrationField, LandingAdditionalQuestion } from './LandingRegistrationForm';

// 고객 정보 타입 (이름, 연락처만 - 이메일 불필요)
export interface CustomerInfo {
  name: string;
  phone: string;
}

// 상품 구매 설정 타입
export interface ProductPurchaseConfig {
  enabled?: boolean;
  paymentProvider?: 'payapp' | string;
  productName?: string;
  sellingPrice?: number | string | null;
  useQuantity?: boolean;
  purchaseQuantity?: number | string | null;
  paymentType?: 'basic' | 'cardInput' | string;
  paymentGroupId?: number | string | null;
  dbGroupId?: number | string | null;
}

interface LandingClientWrapperProps {
  // 랜딩페이지 기본 정보
  slug: string;
  landingPageId: number;

  // 폼 설정
  showFormSection: boolean;
  buttonLabel: string;
  fields: LandingRegistrationField[];
  additionalQuestions: LandingAdditionalQuestion[];

  // 상품 구매 설정
  showProductSection: boolean;
  productPurchase: ProductPurchaseConfig | null;
}

// 가격 포맷팅 (Hydration 에러 방지를 위해 단순 포맷팅)
const formatPrice = (value?: number | string | null): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  const numValue = typeof value === 'string' ? parseInt(value) : value;
  if (isNaN(numValue)) {
    return null;
  }
  // toLocaleString 대신 직접 포맷팅 (Hydration 에러 방지)
  return numValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '원';
};

export function LandingClientWrapper({
  slug,
  landingPageId,
  showFormSection,
  buttonLabel,
  fields,
  additionalQuestions,
  showProductSection,
  productPurchase,
}: LandingClientWrapperProps) {
  // 결제 처리 중 상태
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);

  // 상품구매 활성화 여부
  const isPaymentMode = showProductSection && productPurchase && productPurchase.enabled;

  // 결제 모드일 때 기본 필드 (이름, 연락처는 필수)
  const defaultPaymentFields: LandingRegistrationField[] = [
    { key: 'name', label: '이름', placeholder: '이름을 입력하세요', inputType: 'text', required: true },
    { key: 'phone', label: '연락처', placeholder: '010-1234-5678', inputType: 'tel', required: true },
  ];

  // 결제 모드일 때 필드 처리
  const getFinalFields = (): LandingRegistrationField[] => {
    if (!isPaymentMode) {
      return fields;
    }

    // 결제 모드일 때는 이름과 연락처가 반드시 필요
    if (fields.length === 0) {
      return defaultPaymentFields;
    }

    // 기존 필드에 이름/연락처가 없으면 추가
    const hasName = fields.some(f => f.key === 'name');
    const hasPhone = fields.some(f => f.key === 'phone');

    const result = [...fields];
    if (!hasName) {
      result.unshift({ key: 'name', label: '이름', placeholder: '이름을 입력하세요', inputType: 'text', required: true });
    }
    if (!hasPhone) {
      // 이름 다음에 연락처 추가
      const nameIndex = result.findIndex(f => f.key === 'name');
      result.splice(nameIndex + 1, 0, { key: 'phone', label: '연락처', placeholder: '010-1234-5678', inputType: 'tel', required: true });
    }

    return result;
  };

  const finalFields = getFinalFields();

  // 결제 금액
  const paymentAmount = productPurchase?.sellingPrice
    ? parseInt(String(productPurchase.sellingPrice))
    : 0;

  // 결제 모드일 때 버튼 라벨 변경
  const finalButtonLabel = isPaymentMode && paymentAmount > 0
    ? `${formatPrice(paymentAmount)} 결제하기`
    : buttonLabel;

  // 결제 요청 핸들러
  const handlePaymentRequest = async (customerName: string, customerPhone: string) => {
    if (!productPurchase || !paymentAmount) return;

    setIsPaymentProcessing(true);

    try {
      const response = await fetch('/api/payapp/landing/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          landingPageId,
          productName: productPurchase.productName || '상품',
          amount: paymentAmount,
          customerName,
          customerPhone,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || '결제 요청에 실패했습니다.');
      }

      if (data.payUrl) {
        window.location.href = data.payUrl;
      } else {
        throw new Error('결제 URL을 받지 못했습니다.');
      }
    } catch (error) {
      console.error('[LandingClientWrapper] Payment error:', error);
      alert(error instanceof Error ? error.message : '결제 요청 중 오류가 발생했습니다.');
      setIsPaymentProcessing(false);
    }
  };

  // 폼 표시 여부: 정보수집이 활성화되었거나 결제 모드일 때 표시
  const shouldShowForm = showFormSection || isPaymentMode;

  return (
    <>
      {/* 신청/결제 폼 섹션 */}
      {shouldShowForm && (
        <section className="lp-card" aria-labelledby="lp-form-title">
          <div className="lp-section-label">
            {isPaymentMode ? '결제 신청' : '상담/신청'}
          </div>
          <h2 id="lp-form-title" className="lp-section-title">
            {isPaymentMode ? (productPurchase?.productName || '결제하기') : '신청하기'}
          </h2>

          {/* 결제 모드일 때 상품 정보 표시 */}
          {isPaymentMode && (
            <div className="lp-product-info" style={{
              marginBottom: '24px',
              padding: '20px',
              background: '#f8fafc',
              borderRadius: '12px',
              border: '1px solid #e2e8f0'
            }}>
              {/* 판매금액 */}
              {paymentAmount > 0 && (
                <div className="lp-product-price" style={{ marginBottom: '12px' }}>
                  {formatPrice(paymentAmount)}
                </div>
              )}
              {/* 구매수량 */}
              {productPurchase?.useQuantity && productPurchase?.purchaseQuantity && (
                <p style={{ fontSize: '15px', color: '#475569' }}>
                  구매수량: {productPurchase.purchaseQuantity}개
                </p>
              )}
            </div>
          )}

          <p className="lp-section-description">
            {isPaymentMode
              ? '아래 정보를 입력하고 결제를 진행해주세요.'
              : '필요한 정보를 입력해 주시면 담당자가 확인 후 빠르게 연락드립니다.'}
          </p>

          <LandingRegistrationForm
            slug={slug}
            buttonLabel={finalButtonLabel}
            fields={finalFields}
            additionalQuestions={additionalQuestions}
            isPaymentMode={isPaymentMode || false}
            isPaymentProcessing={isPaymentProcessing}
            onPaymentRequest={handlePaymentRequest}
          />
        </section>
      )}
    </>
  );
}

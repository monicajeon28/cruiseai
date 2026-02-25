'use client';

import { useState, useEffect } from 'react';
import { FiX, FiInfo, FiAlertTriangle, FiGift, FiBell, FiChevronLeft, FiChevronRight, FiUsers } from 'react-icons/fi';
import DOMPurify from 'isomorphic-dompurify';

type Message = {
  id: number;
  title: string;
  content: string;
  messageType: string;
  admin: { id: number; name: string };
  createdAt: string;
};

export default function AdminMessageModal() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  // 메시지 로드
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const response = await fetch('/api/user/messages', {
          credentials: 'include',
        });
        const data = await response.json();
        if (data.ok && data.messages && data.messages.length > 0) {
          setMessages(data.messages);
          setIsVisible(true);
          setCurrentMessageIndex(0);
        }
      } catch (error) {
        console.error('Failed to load messages:', error);
      }
    };

    loadMessages();
  }, []);

  // 메시지 확인 처리
  const handleRead = async (messageId: number) => {
    try {
      await fetch(`/api/user/messages/${messageId}/read`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Failed to mark message as read:', error);
    }
  };

  // 현재 메시지
  const currentMessage = messages[currentMessageIndex];

  // 이전 메시지로 이동
  const handlePrev = () => {
    if (currentMessageIndex > 0) {
      setCurrentMessageIndex(currentMessageIndex - 1);
    }
  };

  // 다음 메시지로 이동
  const handleNext = () => {
    if (currentMessageIndex < messages.length - 1) {
      if (currentMessage) {
        handleRead(currentMessage.id);
      }
      setCurrentMessageIndex(currentMessageIndex + 1);
    } else {
      // 마지막 메시지면 닫기
      if (currentMessage) {
        handleRead(currentMessage.id);
      }
      setIsVisible(false);
    }
  };

  // 메시지 닫기
  const handleClose = () => {
    if (currentMessage) {
      handleRead(currentMessage.id);
    }
    setIsVisible(false);
  };

  // 메시지 타입별 아이콘
  const getIcon = () => {
    switch (currentMessage?.messageType) {
      case 'team-dashboard':
        return <FiUsers className="text-teal-600" size={20} />;
      case 'warning':
        return <FiAlertTriangle className="text-yellow-600" size={20} />;
      case 'promotion':
        return <FiGift className="text-green-600" size={20} />;
      case 'announcement':
        return <FiBell className="text-blue-600" size={20} />;
      default:
        return <FiInfo className="text-blue-600" size={20} />;
    }
  };

  // 메시지 타입별 배경색
  const getBgColor = () => {
    switch (currentMessage?.messageType) {
      case 'team-dashboard':
        return 'bg-teal-50 border-teal-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'promotion':
        return 'bg-green-50 border-green-200';
      case 'announcement':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  if (!isVisible || !currentMessage) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-start z-50 p-4">
      {/* 왼쪽에서 슬라이드되는 팝업 컨테이너 - 화면의 1/3 크기 */}
      <div className="relative w-[33vw] min-w-[300px] max-w-[400px] h-[33vh] min-h-[300px] overflow-hidden">
        {/* 모든 메시지를 가로로 배치하는 슬라이더 */}
        <div
          className="flex h-full transition-transform duration-300 ease-out"
          style={{
            width: `${messages.length * 100}%`,
            transform: `translateX(-${currentMessageIndex * 100}%)`,
          }}
        >
          {messages.map((message, index) => {
            // 각 메시지의 배경색 계산
            const getMessageBgColor = () => {
              switch (message.messageType) {
                case 'team-dashboard':
                  return 'bg-teal-50 border-teal-200';
                case 'warning':
                  return 'bg-yellow-50 border-yellow-200';
                case 'promotion':
                  return 'bg-green-50 border-green-200';
                case 'announcement':
                  return 'bg-blue-50 border-blue-200';
                default:
                  return 'bg-blue-50 border-blue-200';
              }
            };

            // 각 메시지의 아이콘 계산
            const getMessageIcon = () => {
              switch (message.messageType) {
                case 'team-dashboard':
                  return <FiUsers className="text-teal-600" size={20} />;
                case 'warning':
                  return <FiAlertTriangle className="text-yellow-600" size={20} />;
                case 'promotion':
                  return <FiGift className="text-green-600" size={20} />;
                case 'announcement':
                  return <FiBell className="text-blue-600" size={20} />;
                default:
                  return <FiInfo className="text-blue-600" size={20} />;
              }
            };

            return (
              <div
                key={message.id}
                className={`flex-shrink-0 bg-white rounded-r-2xl shadow-2xl border-2 border-r-0 flex flex-col h-full ${getMessageBgColor()}`}
                style={{ width: `${100 / messages.length}%` }}
              >
                {/* 헤더 */}
                <div className="flex items-center justify-between p-3 border-b border-gray-200 flex-shrink-0">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {getMessageIcon()}
                    {message.messageType === 'team-dashboard' && (
                      <span className="text-xs bg-teal-100 text-teal-800 px-2 py-0.5 rounded font-medium">
                        팀 대시보드
                      </span>
                    )}
                    <h2 className="text-base font-bold text-gray-900 truncate">{message.title}</h2>
                  </div>
                  <button
                    onClick={handleClose}
                    className="text-gray-500 hover:text-gray-700 p-1 flex-shrink-0 bg-white rounded-full w-7 h-7 flex items-center justify-center shadow-md hover:shadow-lg transition-all ml-2"
                    aria-label="닫기"
                  >
                    <FiX size={18} />
                  </button>
                </div>

                {/* 내용 - 스크롤 가능하게 */}
                <div className="p-3 overflow-y-auto flex-1">
                  <div
                    className="text-gray-700 text-xs leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(message.content) }}
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    발송자: {message.admin.name}
                  </p>
                </div>

                {/* 푸터 - 네비게이션 버튼 */}
                <div className="px-3 py-2 border-t border-gray-200 flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-2">
                    {messages.length > 1 && (
                      <>
                        <button
                          onClick={handlePrev}
                          disabled={currentMessageIndex === 0}
                          className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          aria-label="이전"
                        >
                          <FiChevronLeft size={18} />
                        </button>
                        <span className="text-xs text-gray-500 px-2">
                          {index + 1} / {messages.length}
                        </span>
                        <button
                          onClick={handleNext}
                          disabled={currentMessageIndex === messages.length - 1}
                          className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          aria-label="다음"
                        >
                          <FiChevronRight size={18} />
                        </button>
                      </>
                    )}
                  </div>
                  <button
                    onClick={handleClose}
                    className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors text-xs ml-auto"
                  >
                    닫기
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}










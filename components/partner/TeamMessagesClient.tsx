'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { FiSend, FiInbox, FiTrash2, FiRefreshCw, FiCheck, FiX, FiArrowLeft, FiSearch, FiActivity, FiUser, FiPhone, FiMessageCircle, FiCalendar, FiFilter, FiCornerUpLeft, FiCheckCircle, FiCircle, FiCheckSquare, FiSquare } from 'react-icons/fi';
import { useRouter } from 'next/navigation';

interface TeamMessagesClientProps {
    partnerId: string;
    profile: any;
    isAdmin?: boolean; // 관리자 모드인지 여부
}

// 상호작용 타입 한글 매핑
const interactionTypeLabels: Record<string, string> = {
    'call': '전화',
    'meeting': '미팅',
    'email': '이메일',
    'sms': 'SMS',
    'kakao': '카카오톡',
    'note': '메모',
    'status_change': '상태변경',
    'document': '문서',
    'reservation': '예약',
    'payment': '결제',
    'other': '기타',
};

type SortOption = 'newest' | 'oldest' | 'unread';
type FilterOption = 'all' | 'unread' | 'read';

export default function TeamMessagesClient({ partnerId, profile, isAdmin = false }: TeamMessagesClientProps) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'messages' | 'activities'>('messages');

    // API 경로 결정 (관리자/파트너)
    const apiBasePath = isAdmin ? '/api/admin/affiliate' : '/api/partner';
    const [viewType, setViewType] = useState<'received' | 'sent'>('received');
    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMessage, setSelectedMessage] = useState<any | null>(null);

    // Sorting & Filtering
    const [sortBy, setSortBy] = useState<SortOption>('newest');
    const [filterBy, setFilterBy] = useState<FilterOption>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showFilterMenu, setShowFilterMenu] = useState(false);

    // Customer Activities
    const [activities, setActivities] = useState<any[]>([]);
    const [activitiesLoading, setActivitiesLoading] = useState(false);
    const [activitiesPage, setActivitiesPage] = useState(1);
    const [activitiesPagination, setActivitiesPagination] = useState<any>(null);

    // Send Form
    const [showSendModal, setShowSendModal] = useState(false);
    const [selectedRecipients, setSelectedRecipients] = useState<number[]>([]);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [sending, setSending] = useState(false);
    const [recipientSearch, setRecipientSearch] = useState('');
    const [isReply, setIsReply] = useState(false);

    // Recipients List
    const [recipients, setRecipients] = useState<any[]>([]);

    // Selection mode for bulk delete (messages)
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedMessageIds, setSelectedMessageIds] = useState<number[]>([]);
    const [deleting, setDeleting] = useState(false);

    // Selection mode for bulk delete (activities)
    const [activitySelectionMode, setActivitySelectionMode] = useState(false);
    const [selectedActivityIds, setSelectedActivityIds] = useState<number[]>([]);
    const [deletingActivities, setDeletingActivities] = useState(false);

    // Unread count
    const unreadCount = useMemo(() => {
        if (viewType !== 'received') return 0;
        return messages.filter(m => !m.isRead).length;
    }, [messages, viewType]);

    // Filtered & sorted messages
    const processedMessages = useMemo(() => {
        let result = [...messages];

        // Filter by search
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(m =>
                m.title?.toLowerCase().includes(query) ||
                m.content?.toLowerCase().includes(query) ||
                m.sender?.name?.toLowerCase().includes(query)
            );
        }

        // Filter by read status
        if (filterBy === 'unread') {
            result = result.filter(m => !m.isRead);
        } else if (filterBy === 'read') {
            result = result.filter(m => m.isRead);
        }

        // Sort
        if (sortBy === 'newest') {
            result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        } else if (sortBy === 'oldest') {
            result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        } else if (sortBy === 'unread') {
            result.sort((a, b) => {
                if (a.isRead === b.isRead) {
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                }
                return a.isRead ? 1 : -1;
            });
        }

        return result;
    }, [messages, searchQuery, filterBy, sortBy]);

    // Filtered recipients based on search
    const filteredRecipients = useMemo(() => {
        if (!recipientSearch.trim()) return recipients;
        const query = recipientSearch.toLowerCase();
        return recipients.filter(r =>
            r.name?.toLowerCase().includes(query) ||
            r.profileType?.toLowerCase().includes(query) ||
            (r.profileType === 'HQ' && '본사'.includes(query)) ||
            (r.profileType === 'BRANCH_MANAGER' && '대리점장'.includes(query)) ||
            (r.profileType === 'SALES_AGENT' && '판매원'.includes(query))
        );
    }, [recipients, recipientSearch]);

    // Fetch activities
    const fetchActivities = useCallback(async (page = 1, append = false) => {
        setActivitiesLoading(true);
        try {
            const res = await fetch(`${apiBasePath}/messages/activities?page=${page}&limit=50`);
            const json = await res.json();
            if (json.ok) {
                if (append) {
                    setActivities(prev => [...prev, ...json.activities]);
                } else {
                    setActivities(json.activities);
                }
                setActivitiesPagination(json.pagination);
            }
        } catch (error) {
            console.error('Failed to fetch activities', error);
        } finally {
            setActivitiesLoading(false);
        }
    }, [apiBasePath]);

    const fetchMessages = useCallback(async () => {
        setLoading(true);
        try {
            // 관리자는 my-messages API 사용, 파트너는 messages API 사용
            const url = isAdmin
                ? `${apiBasePath}/my-messages?${viewType === 'sent' ? 'sentOnly=true' : ''}`
                : `${apiBasePath}/messages?type=${viewType}`;
            const res = await fetch(url);
            const json = await res.json();
            if (json.ok) {
                setMessages(json.messages);
            }
        } catch (error) {
            console.error('Failed to fetch messages', error);
        } finally {
            setLoading(false);
        }
    }, [viewType, isAdmin, apiBasePath]);

    const fetchRecipients = useCallback(async () => {
        try {
            const res = await fetch(`${apiBasePath}/messages/recipients`);
            const json = await res.json();
            if (json.ok) {
                setRecipients(json.recipients);
            }
        } catch (error) {
            console.error('Failed to fetch recipients', error);
        }
    }, [apiBasePath]);

    useEffect(() => {
        fetchMessages();
        fetchRecipients();
    }, [fetchMessages, fetchRecipients]);

    useEffect(() => {
        if (activeTab === 'activities' && activities.length === 0) {
            fetchActivities(1);
        }
    }, [activeTab, activities.length, fetchActivities]);

    // Load settings from localStorage
    useEffect(() => {
        const savedSort = localStorage.getItem('teamMessages_sortBy');
        const savedFilter = localStorage.getItem('teamMessages_filterBy');
        if (savedSort) setSortBy(savedSort as SortOption);
        if (savedFilter) setFilterBy(savedFilter as FilterOption);
    }, []);

    // Save settings to localStorage
    useEffect(() => {
        localStorage.setItem('teamMessages_sortBy', sortBy);
        localStorage.setItem('teamMessages_filterBy', filterBy);
    }, [sortBy, filterBy]);

    const handleSend = async () => {
        if (selectedRecipients.length === 0 || !title || !content) {
            alert('받는 사람, 제목, 내용을 모두 입력해주세요.');
            return;
        }
        setSending(true);
        try {
            console.log('[TeamMessages] Sending message:', { recipientUserIds: selectedRecipients, title, content });
            // 관리자는 send API, 파트너는 messages POST 사용
            const sendUrl = isAdmin ? `${apiBasePath}/messages/send` : `${apiBasePath}/messages`;
            const res = await fetch(sendUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(isAdmin ? {
                    recipientUserId: selectedRecipients[0], // 관리자 API는 단일 수신자
                    title,
                    content
                } : {
                    recipientUserIds: selectedRecipients,
                    title,
                    content
                }),
            });
            const json = await res.json();
            console.log('[TeamMessages] Response:', json);
            if (json.ok) {
                alert(`메시지를 ${json.count || selectedRecipients.length}명에게 전송했습니다!`);
                closeModal();
                if (viewType === 'sent') fetchMessages();
            } else {
                console.error('[TeamMessages] Send failed:', json);
                alert(json.error || '메시지 전송에 실패했습니다.');
            }
        } catch (error) {
            console.error('[TeamMessages] Error:', error);
            alert('메시지 전송 중 오류가 발생했습니다.');
        } finally {
            setSending(false);
        }
    };

    const closeModal = () => {
        setShowSendModal(false);
        setSelectedRecipients([]);
        setTitle('');
        setContent('');
        setRecipientSearch('');
        setIsReply(false);
    };

    const handleReply = (message: any) => {
        const senderId = message.sender?.id || message.adminId;
        const senderName = message.sender?.name;

        // Find recipient in recipients list
        const recipient = recipients.find(r => r.userId === senderId);

        if (recipient) {
            setSelectedRecipients([senderId]);
        } else if (senderId) {
            setSelectedRecipients([senderId]);
        }

        setTitle(message.title?.startsWith('Re: ') ? message.title : `Re: ${message.title}`);
        setContent(`\n\n--- 원본 메시지 ---\n보낸 사람: ${senderName}\n날짜: ${new Date(message.createdAt).toLocaleString('ko-KR')}\n\n${message.content}`);
        setIsReply(true);
        setRecipientSearch('');
        setShowSendModal(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('이 메시지를 삭제하시겠습니까?')) return;
        try {
            // 관리자는 messages/[id] DELETE, 파트너는 messages?id= DELETE
            const deleteUrl = isAdmin
                ? `${apiBasePath}/messages/${id}`
                : `${apiBasePath}/messages?id=${id}`;
            const res = await fetch(deleteUrl, { method: 'DELETE' });
            if (res.ok) {
                fetchMessages();
                if (selectedMessage?.id === id) setSelectedMessage(null);
            }
        } catch (error) {
            alert('삭제에 실패했습니다.');
        }
    };

    const handleMarkAsRead = async (id: number) => {
        try {
            // 관리자는 my-messages POST, 파트너는 messages PATCH
            if (isAdmin) {
                await fetch(`${apiBasePath}/my-messages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ messageId: id }),
                });
            } else {
                await fetch(`${apiBasePath}/messages`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ messageId: id }),
                });
            }
            // Update local state immediately for better UX
            setMessages(prev => prev.map(m => m.id === id ? { ...m, isRead: true } : m));
        } catch (error) {
            console.error('Failed to mark as read');
        }
    };

    const handleMarkAllAsRead = async () => {
        const unreadMessages = messages.filter(m => !m.isRead);
        if (unreadMessages.length === 0) return;

        try {
            if (isAdmin) {
                await Promise.all(unreadMessages.map(m =>
                    fetch(`${apiBasePath}/my-messages`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ messageId: m.id }),
                    })
                ));
            } else {
                await Promise.all(unreadMessages.map(m =>
                    fetch(`${apiBasePath}/messages`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ messageId: m.id }),
                    })
                ));
            }
            // Update local state
            setMessages(prev => prev.map(m => ({ ...m, isRead: true })));
        } catch (error) {
            console.error('Failed to mark all as read');
        }
    };

    const toggleMessageSelection = (id: number) => {
        setSelectedMessageIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedMessageIds.length === processedMessages.length) {
            setSelectedMessageIds([]);
        } else {
            setSelectedMessageIds(processedMessages.map(m => m.id));
        }
    };

    const handleBulkDelete = async () => {
        if (selectedMessageIds.length === 0) return;

        const confirmMsg = selectedMessageIds.length === 1
            ? '선택한 메시지를 삭제하시겠습니까?'
            : `선택한 ${selectedMessageIds.length}개의 메시지를 삭제하시겠습니까?`;

        if (!confirm(confirmMsg)) return;

        setDeleting(true);
        try {
            await Promise.all(selectedMessageIds.map(id => {
                const deleteUrl = isAdmin
                    ? `${apiBasePath}/messages/${id}`
                    : `${apiBasePath}/messages?id=${id}`;
                return fetch(deleteUrl, { method: 'DELETE' });
            }));

            // Clear selection and refresh
            setSelectedMessageIds([]);
            setSelectionMode(false);
            if (selectedMessage && selectedMessageIds.includes(selectedMessage.id)) {
                setSelectedMessage(null);
            }
            fetchMessages();
        } catch (error) {
            alert('일부 메시지 삭제에 실패했습니다.');
        } finally {
            setDeleting(false);
        }
    };

    const cancelSelectionMode = () => {
        setSelectionMode(false);
        setSelectedMessageIds([]);
    };

    // Activity selection functions
    const toggleActivitySelection = (id: number) => {
        setSelectedActivityIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleSelectAllActivities = () => {
        if (selectedActivityIds.length === activities.length) {
            setSelectedActivityIds([]);
        } else {
            setSelectedActivityIds(activities.map(a => a.id));
        }
    };

    const handleBulkDeleteActivities = async () => {
        if (selectedActivityIds.length === 0) return;

        const confirmMsg = selectedActivityIds.length === 1
            ? '선택한 기록을 삭제하시겠습니까?'
            : `선택한 ${selectedActivityIds.length}개의 기록을 삭제하시겠습니까?`;

        if (!confirm(confirmMsg)) return;

        setDeletingActivities(true);
        try {
            const results = await Promise.all(selectedActivityIds.map(id =>
                fetch(`${apiBasePath}/messages/activities/${id}`, { method: 'DELETE' })
            ));

            const failedCount = results.filter(r => !r.ok).length;
            if (failedCount > 0) {
                alert(`${selectedActivityIds.length - failedCount}개 삭제됨, ${failedCount}개 실패`);
            }

            // Clear selection and refresh
            setSelectedActivityIds([]);
            setActivitySelectionMode(false);
            fetchActivities(1);
        } catch (error) {
            alert('일부 기록 삭제에 실패했습니다.');
        } finally {
            setDeletingActivities(false);
        }
    };

    const cancelActivitySelectionMode = () => {
        setActivitySelectionMode(false);
        setSelectedActivityIds([]);
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push(isAdmin ? '/admin/affiliate/team-dashboard' : `/partner/${partnerId}/dashboard`)}
                            className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 p-2 rounded-lg transition-colors flex items-center gap-2"
                            title={isAdmin ? "팀 대시보드로 돌아가기" : "대시보드로 돌아가기"}
                        >
                            <FiArrowLeft size={20} />
                            <span className="text-sm font-medium">{isAdmin ? '팀 대시보드' : '대시보드'}</span>
                        </button>
                        <h1 className="text-2xl font-bold text-gray-900">팀 메시지</h1>
                    </div>
                    <button
                        onClick={() => {
                            setRecipientSearch('');
                            setIsReply(false);
                            setShowSendModal(true);
                        }}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                    >
                        <FiSend /> 메시지 보내기
                    </button>
                </div>

                {/* Main Tabs */}
                <div className="flex gap-2 mb-6 bg-white rounded-xl p-2 shadow-sm border border-gray-200">
                    <button
                        onClick={() => setActiveTab('messages')}
                        className={`flex-1 py-3 px-4 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors ${
                            activeTab === 'messages'
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                        <FiInbox size={18} />
                        팀 메시지
                        {unreadCount > 0 && viewType === 'received' && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                                activeTab === 'messages' ? 'bg-red-500 text-white' : 'bg-red-100 text-red-600'
                            }`}>
                                {unreadCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('activities')}
                        className={`flex-1 py-3 px-4 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors ${
                            activeTab === 'activities'
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                        <FiActivity size={18} />
                        고객 기록 업데이트
                        {activitiesPagination?.totalCount > 0 && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                                activeTab === 'activities' ? 'bg-blue-500' : 'bg-gray-200 text-gray-600'
                            }`}>
                                {activitiesPagination.totalCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* Messages Tab Content */}
                {activeTab === 'messages' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Message List */}
                    <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[600px]">
                        {/* Tabs: Received/Sent */}
                        <div className="p-3 border-b">
                            {selectionMode ? (
                                /* Selection Mode Header */
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={toggleSelectAll}
                                            className="flex items-center gap-1 px-2 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded-lg"
                                        >
                                            {selectedMessageIds.length === processedMessages.length ? (
                                                <><FiCheckSquare size={14} /> 전체해제</>
                                            ) : (
                                                <><FiSquare size={14} /> 전체선택</>
                                            )}
                                        </button>
                                        <span className="text-xs text-gray-500">
                                            {selectedMessageIds.length}개 선택됨
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={handleBulkDelete}
                                            disabled={selectedMessageIds.length === 0 || deleting}
                                            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <FiTrash2 size={12} />
                                            {deleting ? '삭제 중...' : '삭제'}
                                        </button>
                                        <button
                                            onClick={cancelSelectionMode}
                                            className="px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
                                        >
                                            취소
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* Normal Tabs */
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setViewType('received')}
                                        className={`flex-1 py-2 text-sm font-medium rounded-lg flex items-center justify-center gap-1 ${viewType === 'received' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
                                    >
                                        받은 메시지함
                                        {unreadCount > 0 && viewType === 'received' && (
                                            <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[18px]">
                                                {unreadCount}
                                            </span>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => setViewType('sent')}
                                        className={`flex-1 py-2 text-sm font-medium rounded-lg ${viewType === 'sent' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
                                    >
                                        보낸 메시지함
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Search & Filter Bar */}
                        <div className="p-3 border-b space-y-2">
                            {/* Search */}
                            <div className="relative">
                                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="메시지 검색..."
                                    className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        <FiX size={14} />
                                    </button>
                                )}
                            </div>

                            {/* Filter & Sort */}
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <button
                                        onClick={() => setShowFilterMenu(!showFilterMenu)}
                                        className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50"
                                    >
                                        <span className="flex items-center gap-1">
                                            <FiFilter size={12} />
                                            {filterBy === 'all' ? '전체' : filterBy === 'unread' ? '안읽음만' : '읽음만'}
                                        </span>
                                        <span className="text-gray-400">
                                            {sortBy === 'newest' ? '최신순' : sortBy === 'oldest' ? '오래된순' : '안읽음 우선'}
                                        </span>
                                    </button>

                                    {showFilterMenu && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 p-2">
                                            <div className="mb-2">
                                                <p className="text-xs font-medium text-gray-500 mb-1 px-2">필터</p>
                                                <div className="space-y-1">
                                                    {[
                                                        { value: 'all', label: '전체 보기' },
                                                        { value: 'unread', label: '안읽음만' },
                                                        { value: 'read', label: '읽음만' },
                                                    ].map(opt => (
                                                        <button
                                                            key={opt.value}
                                                            onClick={() => { setFilterBy(opt.value as FilterOption); setShowFilterMenu(false); }}
                                                            className={`w-full text-left px-2 py-1 text-xs rounded ${filterBy === opt.value ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50'}`}
                                                        >
                                                            {opt.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="border-t pt-2">
                                                <p className="text-xs font-medium text-gray-500 mb-1 px-2">정렬</p>
                                                <div className="space-y-1">
                                                    {[
                                                        { value: 'newest', label: '최신순' },
                                                        { value: 'oldest', label: '오래된순' },
                                                        { value: 'unread', label: '안읽음 우선' },
                                                    ].map(opt => (
                                                        <button
                                                            key={opt.value}
                                                            onClick={() => { setSortBy(opt.value as SortOption); setShowFilterMenu(false); }}
                                                            className={`w-full text-left px-2 py-1 text-xs rounded ${sortBy === opt.value ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50'}`}
                                                        >
                                                            {opt.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Mark All as Read */}
                                {viewType === 'received' && unreadCount > 0 && (
                                    <button
                                        onClick={handleMarkAllAsRead}
                                        className="flex items-center gap-1 px-2 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded-lg whitespace-nowrap"
                                        title="모두 읽음 처리"
                                    >
                                        <FiCheckCircle size={12} />
                                        모두 읽음
                                    </button>
                                )}

                                {/* Selection Mode Button */}
                                {!selectionMode && processedMessages.length > 0 && (
                                    <button
                                        onClick={() => setSelectionMode(true)}
                                        className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg whitespace-nowrap"
                                        title="선택 삭제"
                                    >
                                        <FiCheckSquare size={12} />
                                        선택
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Messages List */}
                        <div className="flex-1 overflow-y-auto">
                            {loading ? (
                                <div className="flex justify-center items-center h-full text-gray-400">로딩 중...</div>
                            ) : processedMessages.length === 0 ? (
                                <div className="flex flex-col justify-center items-center h-full text-gray-400">
                                    <FiInbox size={32} className="mb-2 opacity-30" />
                                    <p className="text-sm">{searchQuery || filterBy !== 'all' ? '검색 결과가 없습니다.' : '메시지가 없습니다.'}</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100">
                                    {processedMessages.map((msg) => (
                                        <div
                                            key={msg.id}
                                            onClick={() => {
                                                if (selectionMode) {
                                                    toggleMessageSelection(msg.id);
                                                } else {
                                                    setSelectedMessage(msg);
                                                    if (viewType === 'received' && !msg.isRead) handleMarkAsRead(msg.id);
                                                }
                                            }}
                                            className={`p-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                                                selectionMode && selectedMessageIds.includes(msg.id) ? 'bg-blue-50' :
                                                !selectionMode && selectedMessage?.id === msg.id ? 'bg-blue-50' : ''
                                            }`}
                                        >
                                            <div className="flex items-start gap-2">
                                                {/* Selection checkbox or Unread indicator */}
                                                {selectionMode ? (
                                                    <div className="pt-0.5">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedMessageIds.includes(msg.id)}
                                                            onChange={() => toggleMessageSelection(msg.id)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                                        />
                                                    </div>
                                                ) : viewType === 'received' ? (
                                                    <div className="pt-1.5">
                                                        {msg.isRead ? (
                                                            <FiCircle size={8} className="text-gray-300" />
                                                        ) : (
                                                            <div className="w-2 h-2 bg-blue-500 rounded-full" />
                                                        )}
                                                    </div>
                                                ) : null}

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <h3 className={`text-sm truncate ${!msg.isRead && viewType === 'received' ? 'font-semibold text-gray-900' : 'font-medium text-gray-600'}`}>
                                                            {msg.title}
                                                        </h3>
                                                        <span className="text-xs text-gray-400 whitespace-nowrap ml-2 flex-shrink-0">
                                                            {new Date(msg.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 line-clamp-1">{msg.content}</p>
                                                    <div className="mt-1 text-xs text-gray-400">
                                                        {viewType === 'received' ? msg.sender?.name : msg.recipient?.name || 'Unknown'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Message Detail */}
                    <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 h-[600px] flex flex-col">
                        {selectedMessage ? (
                            <>
                                <div className="p-5 border-b">
                                    <div className="flex justify-between items-start mb-3">
                                        <h2 className="text-lg font-bold text-gray-900 flex-1">{selectedMessage.title}</h2>
                                        <div className="flex items-center gap-1">
                                            {viewType === 'received' && (
                                                <button
                                                    onClick={() => handleReply(selectedMessage)}
                                                    className="text-blue-600 hover:bg-blue-50 p-2 rounded-full transition-colors"
                                                    title="답장"
                                                >
                                                    <FiCornerUpLeft size={18} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDelete(selectedMessage.id)}
                                                className="text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors"
                                                title="삭제"
                                            >
                                                <FiTrash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                                        <div className="flex items-center gap-1">
                                            <span className="text-gray-400">보낸 사람:</span>
                                            <span className="font-medium text-gray-700">{selectedMessage.sender?.name}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="text-gray-400">받는 사람:</span>
                                            <span>{selectedMessage.recipient?.name || 'Unknown'}</span>
                                        </div>
                                        <div className="ml-auto text-xs text-gray-400">
                                            {new Date(selectedMessage.createdAt).toLocaleString('ko-KR')}
                                        </div>
                                    </div>
                                </div>
                                <div className="p-5 flex-1 overflow-y-auto">
                                    <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                                        {selectedMessage.content}
                                    </div>
                                </div>
                                {viewType === 'received' && (
                                    <div className="p-4 border-t bg-gray-50">
                                        <button
                                            onClick={() => handleReply(selectedMessage)}
                                            className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 text-sm font-medium"
                                        >
                                            <FiCornerUpLeft size={16} />
                                            답장하기
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                <FiInbox size={48} className="mb-4 opacity-20" />
                                <p>메시지를 선택하여 내용을 확인하세요.</p>
                            </div>
                        )}
                    </div>
                </div>
                )}

                {/* Activities Tab Content */}
                {activeTab === 'activities' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* Header */}
                    <div className="p-4 border-b bg-gray-50">
                        {activitySelectionMode ? (
                            /* Selection Mode Header */
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={toggleSelectAllActivities}
                                        className="flex items-center gap-1 px-2 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded-lg"
                                    >
                                        {selectedActivityIds.length === activities.length ? (
                                            <><FiCheckSquare size={14} /> 전체해제</>
                                        ) : (
                                            <><FiSquare size={14} /> 전체선택</>
                                        )}
                                    </button>
                                    <span className="text-xs text-gray-500">
                                        {selectedActivityIds.length}개 선택됨
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={handleBulkDeleteActivities}
                                        disabled={selectedActivityIds.length === 0 || deletingActivities}
                                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <FiTrash2 size={12} />
                                        {deletingActivities ? '삭제 중...' : '삭제'}
                                    </button>
                                    <button
                                        onClick={cancelActivitySelectionMode}
                                        className="px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
                                    >
                                        취소
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Normal Header */
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="font-semibold text-gray-900">고객 기록 업데이트</h2>
                                    <p className="text-xs text-gray-500 mt-1">최근 30일간의 팀 활동 기록입니다.</p>
                                </div>
                                <div className="flex items-center gap-1">
                                    {activities.length > 0 && (
                                        <button
                                            onClick={() => setActivitySelectionMode(true)}
                                            className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
                                            title="선택 삭제"
                                        >
                                            <FiCheckSquare size={14} />
                                            선택
                                        </button>
                                    )}
                                    <button
                                        onClick={() => fetchActivities(1)}
                                        disabled={activitiesLoading}
                                        className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-colors disabled:opacity-50"
                                        title="새로고침"
                                    >
                                        <FiRefreshCw size={18} className={activitiesLoading ? 'animate-spin' : ''} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Activities List */}
                    <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                        {activitiesLoading && activities.length === 0 ? (
                            <div className="flex justify-center items-center py-20 text-gray-400">
                                <FiRefreshCw className="animate-spin mr-2" /> 로딩 중...
                            </div>
                        ) : activities.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                                <FiActivity size={48} className="mb-4 opacity-20" />
                                <p>최근 30일간 기록이 없습니다.</p>
                            </div>
                        ) : (
                            <>
                                {activities.map((activity) => (
                                    <div
                                        key={activity.id}
                                        onClick={() => {
                                            if (activitySelectionMode) {
                                                toggleActivitySelection(activity.id);
                                            }
                                        }}
                                        className={`p-4 hover:bg-gray-50 transition-colors ${
                                            activitySelectionMode && selectedActivityIds.includes(activity.id) ? 'bg-blue-50' :
                                            !activity.isOwn ? 'border-l-4 border-green-400' : 'border-l-4 border-transparent'
                                        } ${activitySelectionMode ? 'cursor-pointer' : ''}`}
                                    >
                                        <div className="flex items-start gap-3">
                                            {/* Selection checkbox */}
                                            {activitySelectionMode && (
                                                <div className="pt-0.5">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedActivityIds.includes(activity.id)}
                                                        onChange={() => toggleActivitySelection(activity.id)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                                    />
                                                </div>
                                            )}
                                            {/* Icon */}
                                            <div className={`p-2 rounded-lg ${
                                                activity.interactionType === 'call' ? 'bg-blue-100 text-blue-600' :
                                                activity.interactionType === 'meeting' ? 'bg-purple-100 text-purple-600' :
                                                activity.interactionType === 'kakao' ? 'bg-yellow-100 text-yellow-600' :
                                                activity.interactionType === 'sms' ? 'bg-green-100 text-green-600' :
                                                activity.interactionType === 'reservation' ? 'bg-orange-100 text-orange-600' :
                                                activity.interactionType === 'payment' ? 'bg-pink-100 text-pink-600' :
                                                'bg-gray-100 text-gray-600'
                                            }`}>
                                                {activity.interactionType === 'call' ? <FiPhone size={16} /> :
                                                 activity.interactionType === 'meeting' ? <FiUser size={16} /> :
                                                 <FiMessageCircle size={16} />}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                                        activity.interactionType === 'call' ? 'bg-blue-100 text-blue-700' :
                                                        activity.interactionType === 'meeting' ? 'bg-purple-100 text-purple-700' :
                                                        activity.interactionType === 'kakao' ? 'bg-yellow-100 text-yellow-700' :
                                                        activity.interactionType === 'sms' ? 'bg-green-100 text-green-700' :
                                                        activity.interactionType === 'reservation' ? 'bg-orange-100 text-orange-700' :
                                                        activity.interactionType === 'payment' ? 'bg-pink-100 text-pink-700' :
                                                        'bg-gray-100 text-gray-700'
                                                    }`}>
                                                        {interactionTypeLabels[activity.interactionType] || activity.interactionType}
                                                    </span>
                                                    {!activity.isOwn && (
                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                                            {activity.profile?.displayName || '팀원'}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Customer Info */}
                                                {activity.lead && (
                                                    <div className="flex items-center gap-2 text-sm font-medium text-gray-900 mb-1">
                                                        <FiUser size={14} className="text-gray-400" />
                                                        <span>{activity.lead.customerName || '(이름 없음)'}</span>
                                                        {activity.lead.customerPhone && (
                                                            <span className="text-gray-500 text-xs">
                                                                {activity.lead.customerPhone}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Note */}
                                                {activity.note && (
                                                    <p className="text-sm text-gray-600 line-clamp-2">{activity.note}</p>
                                                )}

                                                {/* Time */}
                                                <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                                                    <FiCalendar size={12} />
                                                    <span>{new Date(activity.occurredAt).toLocaleString('ko-KR')}</span>
                                                    {activity.createdBy && activity.createdBy.id !== activity.profile?.id && (
                                                        <span className="ml-2">· 작성자: {activity.createdBy.name}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {/* Load More Button */}
                                {activitiesPagination?.hasMore && (
                                    <div className="p-4 text-center border-t">
                                        <button
                                            onClick={() => {
                                                const nextPage = activitiesPage + 1;
                                                setActivitiesPage(nextPage);
                                                fetchActivities(nextPage, true);
                                            }}
                                            disabled={activitiesLoading}
                                            className="text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                        >
                                            {activitiesLoading ? '로딩 중...' : `더 보기 (${activitiesPagination.totalCount - activities.length}건 남음)`}
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
                )}
            </div>

            {/* Send Modal */}
            {showSendModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-lg">
                                {isReply ? '답장 보내기' : '새 메시지 보내기'}
                            </h3>
                            <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                                <FiX size={24} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">받는 사람</label>

                                {/* Search Input */}
                                <div className="relative mb-3">
                                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                    <input
                                        type="text"
                                        value={recipientSearch}
                                        onChange={(e) => setRecipientSearch(e.target.value)}
                                        placeholder="이름 또는 역할로 검색..."
                                        className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                                    />
                                    {recipientSearch && (
                                        <button
                                            onClick={() => setRecipientSearch('')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            <FiX size={16} />
                                        </button>
                                    )}
                                </div>

                                {/* Select All (only for filtered results) */}
                                <div className="mb-3 pb-3 border-b">
                                    <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                                        <input
                                            type="checkbox"
                                            checked={filteredRecipients.length > 0 && filteredRecipients.every(r => selectedRecipients.includes(r.userId))}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    const newIds = filteredRecipients.map(r => r.userId);
                                                    setSelectedRecipients([...new Set([...selectedRecipients, ...newIds])]);
                                                } else {
                                                    const filteredIds = filteredRecipients.map(r => r.userId);
                                                    setSelectedRecipients(selectedRecipients.filter(id => !filteredIds.includes(id)));
                                                }
                                            }}
                                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                        />
                                        <span className="font-medium text-gray-900">
                                            {recipientSearch ? `검색 결과 전체 선택 (${filteredRecipients.length}명)` : `전체 선택 (${recipients.length}명)`}
                                        </span>
                                    </label>
                                </div>

                                {/* Recipients List */}
                                <div className="max-h-48 overflow-y-auto space-y-1 mb-3 border rounded-lg">
                                    {filteredRecipients.length === 0 ? (
                                        <div className="p-4 text-center text-gray-500 text-sm">
                                            {recipientSearch ? '검색 결과가 없습니다.' : '사용 가능한 수신자가 없습니다.'}
                                        </div>
                                    ) : (
                                        filteredRecipients.map((recipient) => (
                                            <label
                                                key={recipient.userId}
                                                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedRecipients.includes(recipient.userId)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedRecipients([...selectedRecipients, recipient.userId]);
                                                        } else {
                                                            setSelectedRecipients(selectedRecipients.filter(id => id !== recipient.userId));
                                                        }
                                                    }}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                                />
                                                <span className="text-sm flex-1">
                                                    {recipient.name}
                                                </span>
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                                    recipient.profileType === 'HQ' ? 'bg-purple-100 text-purple-700' :
                                                    recipient.profileType === 'BRANCH_MANAGER' ? 'bg-blue-100 text-blue-700' :
                                                    'bg-green-100 text-green-700'
                                                }`}>
                                                    {recipient.profileType === 'HQ' ? '본사' : recipient.profileType === 'BRANCH_MANAGER' ? '대리점장' : '판매원'}
                                                </span>
                                            </label>
                                        ))
                                    )}
                                </div>

                                {/* Selected Recipients Display */}
                                {selectedRecipients.length > 0 && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-xs font-medium text-blue-900">
                                                선택된 수신자 ({selectedRecipients.length}명)
                                            </p>
                                            <button
                                                onClick={() => setSelectedRecipients([])}
                                                className="text-xs text-blue-600 hover:text-blue-800"
                                            >
                                                전체 해제
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedRecipients.map(userId => {
                                                const recipient = recipients.find(r => r.userId === userId);
                                                return recipient ? (
                                                    <span
                                                        key={userId}
                                                        className="inline-flex items-center gap-1 bg-white border border-blue-300 rounded-full px-3 py-1 text-sm"
                                                    >
                                                        {recipient.name}
                                                        <button
                                                            onClick={() => setSelectedRecipients(selectedRecipients.filter(id => id !== userId))}
                                                            className="text-gray-500 hover:text-red-600"
                                                        >
                                                            <FiX size={14} />
                                                        </button>
                                                    </span>
                                                ) : null;
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                    placeholder="제목을 입력하세요"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
                                <textarea
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg p-2 h-32 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                                    placeholder="내용을 입력하세요"
                                />
                            </div>
                        </div>
                        <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
                            <button
                                onClick={closeModal}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleSend}
                                disabled={sending}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {sending ? '전송 중...' : isReply ? '답장 보내기' : '보내기'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

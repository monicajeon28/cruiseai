'use client';

import { ReactNode } from 'react';

export type ActivityType = 'sale' | 'registration' | 'message' | 'approval' | 'commission' | 'other';

export interface Activity {
    id: string | number;
    type: ActivityType;
    title: string;
    description?: string;
    timestamp: Date | string;
    icon?: ReactNode;
    link?: string;
}

interface ActivityFeedProps {
    activities: Activity[];
    loading?: boolean;
    emptyMessage?: string;
}

const activityIcons: Record<ActivityType, string> = {
    sale: '💰',
    registration: '👤',
    message: '✉️',
    approval: '✅',
    commission: '💵',
    other: '📌',
};

const activityColors: Record<ActivityType, string> = {
    sale: 'bg-green-100 text-green-800',
    registration: 'bg-blue-100 text-blue-800',
    message: 'bg-purple-100 text-purple-800',
    approval: 'bg-yellow-100 text-yellow-800',
    commission: 'bg-pink-100 text-pink-800',
    other: 'bg-gray-100 text-gray-800',
};

function formatTimeAgo(date: Date | string): string {
    const now = new Date();
    const past = new Date(date);
    const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

    if (diffInSeconds < 60) return '방금 전';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}분 전`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}시간 전`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}일 전`;

    return past.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

export default function ActivityFeed({
    activities,
    loading = false,
    emptyMessage = '최근 활동이 없습니다',
}: ActivityFeedProps) {
    if (loading) {
        return (
            <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">최근 활동</h3>
                <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="animate-pulse flex gap-3">
                            <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                            <div className="flex-1">
                                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4">최근 활동</h3>

            {activities.length === 0 ? (
                <div className="text-center py-8">
                    <p className="text-gray-500">{emptyMessage}</p>
                </div>
            ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                    {activities.map((activity) => {
                        const ActivityContent = (
                            <div className="flex gap-3 items-start">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${activityColors[activity.type]}`}>
                                    {activity.icon || activityIcons[activity.type]}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">
                                        {activity.title}
                                    </p>
                                    {activity.description && (
                                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                                            {activity.description}
                                        </p>
                                    )}
                                    <p className="text-xs text-gray-400 mt-1">
                                        {formatTimeAgo(activity.timestamp)}
                                    </p>
                                </div>
                            </div>
                        );

                        if (activity.link) {
                            return (
                                <a
                                    key={activity.id}
                                    href={activity.link}
                                    className="block p-3 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    {ActivityContent}
                                </a>
                            );
                        }

                        return (
                            <div
                                key={activity.id}
                                className="p-3 rounded-lg"
                            >
                                {ActivityContent}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

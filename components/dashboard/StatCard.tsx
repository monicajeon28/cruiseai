'use client';

import { ReactNode } from 'react';
import { FiTrendingUp, FiTrendingDown, FiMinus } from 'react-icons/fi';

interface StatCardProps {
    title: string;
    value: string | number;
    icon?: ReactNode;
    trend?: {
        value: number; // percentage
        isPositive: boolean;
        label?: string;
    };
    loading?: boolean;
    bgColor?: string;
    iconColor?: string;
}

export default function StatCard({
    title,
    value,
    icon,
    trend,
    loading = false,
    bgColor = 'bg-white',
    iconColor = 'text-blue-600',
}: StatCardProps) {
    if (loading) {
        return (
            <div className={`${bgColor} p-6 rounded-xl shadow-md border border-gray-200`}>
                <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                    <div className="h-8 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                </div>
            </div>
        );
    }

    return (
        <div className={`${bgColor} p-6 rounded-xl shadow-md border border-gray-200 hover:shadow-lg transition-shadow`}>
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
                    <p className="text-3xl font-bold text-gray-900">{value}</p>
                </div>
                {icon && (
                    <div className={`${iconColor} bg-opacity-10 p-3 rounded-lg`}>
                        {icon}
                    </div>
                )}
            </div>

            {trend && (
                <div className="flex items-center gap-1">
                    {trend.value > 0 ? (
                        <FiTrendingUp className={trend.isPositive ? 'text-green-600' : 'text-red-600'} size={16} />
                    ) : trend.value < 0 ? (
                        <FiTrendingDown className={trend.isPositive ? 'text-red-600' : 'text-green-600'} size={16} />
                    ) : (
                        <FiMinus className="text-gray-400" size={16} />
                    )}
                    <span className={`text-sm font-medium ${trend.value > 0
                            ? (trend.isPositive ? 'text-green-600' : 'text-red-600')
                            : trend.value < 0
                                ? (trend.isPositive ? 'text-red-600' : 'text-green-600')
                                : 'text-gray-500'
                        }`}>
                        {Math.abs(trend.value)}%
                    </span>
                    {trend.label && (
                        <span className="text-sm text-gray-500">
                            {trend.label}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

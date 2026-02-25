'use client';

import { ReactNode } from 'react';

export interface QuickAction {
    id: string;
    label: string;
    icon: ReactNode;
    href?: string;
    onClick?: () => void;
    color?: string;
    disabled?: boolean;
}

interface QuickActionsProps {
    actions: QuickAction[];
    title?: string;
}

export default function QuickActions({
    actions,
    title = '빠른 작업',
}: QuickActionsProps) {
    return (
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4">{title}</h3>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {actions.map((action) => {
                    const buttonClass = `
            flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all
            ${action.disabled
                            ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50'
                            : `border-${action.color || 'blue'}-200 bg-${action.color || 'blue'}-50 hover:bg-${action.color || 'blue'}-100 hover:shadow-md cursor-pointer`
                        }
          `;

                    const content = (
                        <>
                            <div className={`text-2xl ${action.disabled ? 'text-gray-400' : `text-${action.color || 'blue'}-600`}`}>
                                {action.icon}
                            </div>
                            <span className={`text-sm font-medium text-center ${action.disabled ? 'text-gray-400' : 'text-gray-900'}`}>
                                {action.label}
                            </span>
                        </>
                    );

                    if (action.href && !action.disabled) {
                        return (
                            <a
                                key={action.id}
                                href={action.href}
                                className={buttonClass}
                            >
                                {content}
                            </a>
                        );
                    }

                    return (
                        <button
                            key={action.id}
                            onClick={action.onClick}
                            disabled={action.disabled}
                            className={buttonClass}
                        >
                            {content}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { BroilerProvider } from "@/components/broiler/broiler-provider";

export default function QueryProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 10000 }, mutations: { retry: false } } }));

    return (
        <QueryClientProvider client={queryClient}>
            <BroilerProvider>{children}</BroilerProvider>
        </QueryClientProvider>
    );
}

import {
  render,
  renderHook as baseRenderHook,
  type RenderOptions,
  type RenderHookOptions,
} from "@testing-library/react";
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { I18nextProvider } from "react-i18next";
import i18n from "i18next";
import { classifyError } from "@/lib/errors/classifyError";
import { initReactI18next } from "react-i18next";
import userEvent from "@testing-library/user-event";
import type { ReactElement, ReactNode } from "react";

i18n.use(initReactI18next).init({
  lng: "cimode",
  resources: {},
  interpolation: { escapeValue: false },
  showSupportNotice: false,
});

const createTestQueryClient = () => {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        const meta = query.meta as { errorMessage?: string } | undefined;
        if (meta?.errorMessage) {
          toast.error(meta.errorMessage, {
            description: i18n.t(classifyError(error.message)),
            duration: 10_000,
          });
        }
      },
    }),
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
};

const Providers = ({ children }: { children: ReactNode }) => {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </QueryClientProvider>
  );
};

export const renderWithProviders = (
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) => {
  return render(ui, { wrapper: Providers, ...options });
};

export const renderHook = <Result, Props>(
  hook: (props: Props) => Result,
  options?: RenderHookOptions<Props>,
) => baseRenderHook(hook, { wrapper: Providers, ...options });

export const setupUser = () => userEvent.setup();

export { screen, within, waitFor } from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";

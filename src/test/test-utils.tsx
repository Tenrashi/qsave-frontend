import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import i18n from "i18next";
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

export const setupUser = () => userEvent.setup();

export { screen, within, waitFor } from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";

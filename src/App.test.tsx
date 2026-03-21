import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  renderWithProviders,
  screen,
  setupUser,
  waitFor,
} from "@/test/test-utils";
import { useAuthStore } from "@/stores/auth";
import { useSyncStore } from "@/stores/sync";
import { sims4Game, cyberpunkGame, steamCloudGame } from "@/test/mocks/games";
import { RECORD_STATUS } from "@/domain/types";
import type { AuthState, Game, SyncRecord } from "@/domain/types";
import App from "./App";

const { mockScanForGames, mockGetSyncHistory, mockGetAuthState } = vi.hoisted(
  () => ({
    mockScanForGames: vi.fn<() => Promise<Game[]>>(() => Promise.resolve([])),
    mockGetSyncHistory: vi.fn<() => Promise<SyncRecord[]>>(() =>
      Promise.resolve([]),
    ),
    mockGetAuthState: vi.fn<() => Promise<AuthState>>(() =>
      Promise.resolve({ isAuthenticated: false }),
    ),
  }),
);

vi.mock("@/services/scanner/scanner", () => ({
  scanForGames: mockScanForGames,
}));

vi.mock("@/lib/store/store", () => ({
  getAuthState: mockGetAuthState,
  getSyncHistory: mockGetSyncHistory,
  getWatchedGames: vi.fn(() => Promise.resolve([])),
  getSyncFingerprints: vi.fn(() => Promise.resolve({})),
  setWatchedGames: vi.fn(),
  setSyncFingerprint: vi.fn(),
}));

vi.mock("@/hooks/useAutoSync/useAutoSync", () => ({
  useAutoSync: vi.fn(),
}));

vi.mock("@/hooks/useGameDetectionNotify/useGameDetectionNotify", () => ({
  useGameDetectionNotify: vi.fn(),
}));

vi.mock("@/services/drive/drive", () => ({
  listBackedUpGameNames: vi.fn(() => Promise.resolve([])),
}));

vi.mock("@/services/auth/auth", () => ({
  startOAuthFlow: vi.fn(),
}));

vi.mock("@/components/SavesList/SavesList", () => ({
  SavesList: ({ games }: { games: Game[] }) => (
    <div>
      {games.map((game) => (
        <div key={game.name}>{game.name}</div>
      ))}
    </div>
  ),
}));

const authenticateUser = () => {
  mockGetAuthState.mockResolvedValue({
    isAuthenticated: true,
    email: "test@gmail.com",
  });
  useAuthStore.setState({
    auth: { isAuthenticated: true, email: "test@gmail.com" },
    loading: false,
  });
};

describe("App", () => {
  const user = setupUser();

  beforeEach(() => {
    vi.clearAllMocks();
    mockScanForGames.mockResolvedValue([]);
    mockGetSyncHistory.mockResolvedValue([]);
    mockGetAuthState.mockResolvedValue({ isAuthenticated: false });
    useAuthStore.setState({ auth: { isAuthenticated: false }, loading: false });
    useSyncStore.setState({
      gameStatuses: {},
      watchedGames: {},
      syncFingerprints: {},
      backedUpGames: new Set<string>(),
      backedUpGamesLoaded: false,
    });
  });

  it("renders app header with name and refresh button", async () => {
    renderWithProviders(<App />);
    await waitFor(() => expect(mockGetAuthState).toHaveBeenCalled());
    expect(screen.getByText("QSave")).toBeInTheDocument();
    expect(screen.getByText("app.refresh")).toBeInTheDocument();
  });

  it("renders search bar", async () => {
    renderWithProviders(<App />);
    await waitFor(() => expect(mockGetAuthState).toHaveBeenCalled());
    expect(
      screen.getByPlaceholderText("search.placeholder"),
    ).toBeInTheDocument();
  });

  it("shows error banner when games query fails", async () => {
    mockScanForGames.mockRejectedValue(new Error("scan failed"));
    renderWithProviders(<App />);
    expect(await screen.findByText("scan failed")).toBeInTheDocument();
  });

  it("renders local games from scanner", async () => {
    mockScanForGames.mockResolvedValue([sims4Game, cyberpunkGame]);
    renderWithProviders(<App />);
    expect(await screen.findByText("The Sims 4")).toBeInTheDocument();
    expect(screen.getByText("Cyberpunk 2077")).toBeInTheDocument();
  });

  it("filters games by search", async () => {
    mockScanForGames.mockResolvedValue([sims4Game, cyberpunkGame]);
    renderWithProviders(<App />);
    await screen.findByText("The Sims 4");

    await user.type(screen.getByPlaceholderText("search.placeholder"), "cyber");

    await waitFor(() => {
      expect(screen.queryByText("The Sims 4")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Cyberpunk 2077")).toBeInTheDocument();
  });

  it("calls refetch and refreshBackedUpGames on refresh click when authenticated", async () => {
    authenticateUser();
    renderWithProviders(<App />);

    await user.click(screen.getByText("app.refresh"));

    await waitFor(() => {
      expect(mockScanForGames).toHaveBeenCalledTimes(2); // initial + refresh
    });
  });

  it("calls refetch but not refreshBackedUpGames when not authenticated", async () => {
    renderWithProviders(<App />);

    await user.click(screen.getByText("app.refresh"));

    await waitFor(() => {
      expect(mockScanForGames).toHaveBeenCalledTimes(2);
    });
  });

  it("shows sync history panel when history data exists", async () => {
    mockGetSyncHistory.mockResolvedValue([
      {
        id: "r1",
        gameName: "The Sims 4",
        fileName: "The Sims 4.zip",
        syncedAt: new Date(),
        driveFileId: "f1",
        revisionCount: 1,
        status: RECORD_STATUS.success,
        type: "sync",
      },
    ]);

    renderWithProviders(<App />);
    await waitFor(() => {
      expect(screen.getByText("history.title")).toBeInTheDocument();
    });
  });

  it("hides sync history panel when no history data", async () => {
    renderWithProviders(<App />);
    await waitFor(() => expect(mockGetAuthState).toHaveBeenCalled());
    expect(screen.queryByText("history.title")).not.toBeInTheDocument();
  });

  it("toggles watching state", async () => {
    renderWithProviders(<App />);
    const toggleButton = screen.getByText("status.watchingActive");
    await user.click(toggleButton);
    expect(screen.getByText("status.watchingInactive")).toBeInTheDocument();
  });

  describe("steam cloud filter", () => {
    it("hides steam cloud games when toggle is clicked", async () => {
      mockScanForGames.mockResolvedValue([sims4Game, steamCloudGame]);
      renderWithProviders(<App />);
      await screen.findByText("The Sims 4");
      expect(screen.getByText("Portal 2")).toBeInTheDocument();

      await user.click(screen.getByTitle("games.hideSteamCloud"));

      await waitFor(() => {
        expect(screen.queryByText("Portal 2")).not.toBeInTheDocument();
      });
      expect(screen.getByText("The Sims 4")).toBeInTheDocument();
    });

    it("shows steam cloud games again when toggle is clicked twice", async () => {
      mockScanForGames.mockResolvedValue([sims4Game, steamCloudGame]);
      renderWithProviders(<App />);
      await screen.findByText("Portal 2");

      await user.click(screen.getByTitle("games.hideSteamCloud"));
      await waitFor(() => {
        expect(screen.queryByText("Portal 2")).not.toBeInTheDocument();
      });

      await user.click(screen.getByTitle("games.showSteamCloud"));
      await waitFor(() => {
        expect(screen.getByText("Portal 2")).toBeInTheDocument();
      });
    });
  });

  describe("cloud-only games", () => {
    it("does not show cloud-only games when not authenticated", async () => {
      mockScanForGames.mockResolvedValue([sims4Game]);
      useSyncStore.setState({
        backedUpGames: new Set(["Cloud RPG"]),
        backedUpGamesLoaded: true,
      });

      renderWithProviders(<App />);
      await screen.findByText("The Sims 4");
      expect(screen.queryByText("Cloud RPG")).not.toBeInTheDocument();
    });

    it("does not show cloud-only games when backed up games not loaded", async () => {
      mockScanForGames.mockResolvedValue([sims4Game]);
      authenticateUser();
      useSyncStore.setState({
        backedUpGames: new Set(["Cloud RPG"]),
        backedUpGamesLoaded: false,
      });

      renderWithProviders(<App />);
      await screen.findByText("The Sims 4");
      expect(screen.queryByText("Cloud RPG")).not.toBeInTheDocument();
    });

    it("shows cloud-only games when authenticated and loaded", async () => {
      mockScanForGames.mockResolvedValue([sims4Game]);
      authenticateUser();
      useSyncStore.setState({
        backedUpGames: new Set(["The Sims 4", "Cloud RPG"]),
        backedUpGamesLoaded: true,
      });

      renderWithProviders(<App />);
      await screen.findByText("The Sims 4");
      expect(screen.getByText("Cloud RPG")).toBeInTheDocument();
    });

    it("excludes local games from cloud-only list", async () => {
      mockScanForGames.mockResolvedValue([sims4Game]);
      authenticateUser();
      useSyncStore.setState({
        backedUpGames: new Set(["The Sims 4"]),
        backedUpGamesLoaded: true,
      });

      renderWithProviders(<App />);
      await screen.findByText("The Sims 4");
      expect(screen.getAllByText("The Sims 4")).toHaveLength(1);
    });

    it("sorts cloud-only games alphabetically with local games", async () => {
      mockScanForGames.mockResolvedValue([sims4Game]);
      authenticateUser();
      useSyncStore.setState({
        backedUpGames: new Set(["Alpha Game", "Zebra Game"]),
        backedUpGamesLoaded: true,
      });

      renderWithProviders(<App />);
      await screen.findByText("The Sims 4");

      const gameNames = screen
        .getAllByText(/Alpha Game|The Sims 4|Zebra Game/)
        .map((element) => element.textContent);
      expect(gameNames).toEqual(["Alpha Game", "The Sims 4", "Zebra Game"]);
    });

    it("filters cloud-only games by search", async () => {
      mockScanForGames.mockResolvedValue([sims4Game]);
      authenticateUser();
      useSyncStore.setState({
        backedUpGames: new Set(["Cloud RPG"]),
        backedUpGamesLoaded: true,
      });

      renderWithProviders(<App />);
      await screen.findByText("The Sims 4");

      await user.type(
        screen.getByPlaceholderText("search.placeholder"),
        "cloud",
      );

      await waitFor(() => {
        expect(screen.queryByText("The Sims 4")).not.toBeInTheDocument();
      });
      expect(screen.getByText("Cloud RPG")).toBeInTheDocument();
    });
  });
});

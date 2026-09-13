import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { StorageProbeCard } from "@/components/dev/storage-probe-card";
import { getStorageProbePaths, readStorageProbe, writeStorageProbe } from "@/lib/vault/api";
import { VaultCommandError } from "@/lib/vault/error";
import type { StorageProbeFile, StorageProbeListing, StorageProbeRecord, StorageProbeResult } from "@/lib/vault/types";

vi.mock("@/lib/vault/api");

const pathsMock = vi.mocked(getStorageProbePaths);
const readMock = vi.mocked(readStorageProbe);
const writeMock = vi.mocked(writeStorageProbe);

const paths = {
  vaultRoot: "/vault",
  dbPath: "/vault/db/stashly.db",
  filesDir: "/vault/files",
};

const record: StorageProbeRecord = { id: 2, label: "Smoke test", createdAt: "2026-09-13T16:45:12.345Z" };
const fileName = "probe-20260913-164512-2.txt";
const file: StorageProbeFile = { name: fileName, bytes: 88, modifiedAt: "2026-09-13T16:45:13.001Z" };
const listing: StorageProbeListing = { records: [record], files: [file] };
const result: StorageProbeResult = {
  dbRecordId: record.id,
  dbRecordLabel: record.label,
  dbRecordCreatedAt: record.createdAt,
  dbPath: paths.dbPath,
  vaultRoot: paths.vaultRoot,
  filePath: `${paths.filesDir}/${fileName}`,
  fileName,
  fileBytes: file.bytes,
};

/** The label field the write is sent with, found the way a user finds it. */
function labelField() {
  return screen.getByLabelText(/probe label/i);
}

function writeButton() {
  return screen.getByRole("button", { name: /write test record and file/i });
}

describe("Storage probe card", () => {
  // A block body on purpose: a concise arrow here would return the mock, and Vitest
  // treats a function returned from a hook as teardown, so it would call the mock again
  // after every test and any still-configured rejection would surface as an unhandled
  // rejection attributed to a test whose assertions are correct.
  beforeEach(() => {
    pathsMock.mockReset();
    readMock.mockReset();
    writeMock.mockReset();
    pathsMock.mockResolvedValue(paths);
    readMock.mockResolvedValue({ records: [], files: [] });
  });

  test("writes the typed label and then re-reads the vault", async () => {
    const user = userEvent.setup();
    writeMock.mockResolvedValue(result);
    render(<StorageProbeCard />);

    await user.type(labelField(), "Smoke test");
    await user.click(writeButton());

    await waitFor(() => {
      expect(writeMock).toHaveBeenCalledWith("Smoke test");
    });

    // The card re-reads after a successful write instead of trusting what the write
    // returned, so both tables show what is actually on disk.
    await waitFor(() => {
      expect(readMock.mock.calls.length).toBeGreaterThan(1);
    });
    const reads = readMock.mock.invocationCallOrder;
    expect(reads[reads.length - 1]).toBeGreaterThan(writeMock.mock.invocationCallOrder[0]);
  });

  test("lists the record and the file the vault reports back", async () => {
    const user = userEvent.setup();
    writeMock.mockResolvedValue(result);
    // The vault only lists what has been written, so the read on mount is empty and the
    // read after the write is the populated one.
    readMock.mockImplementation(async () => (writeMock.mock.calls.length > 0 ? listing : { records: [], files: [] }));
    render(<StorageProbeCard />);

    await user.type(labelField(), "Smoke test");
    await user.click(writeButton());

    expect(await screen.findByText(record.label)).toBeInTheDocument();
    expect(screen.getByText(fileName)).toBeInTheDocument();
    expect(screen.getByText(record.createdAt)).toBeInTheDocument();
    // `modifiedAt`, not `modified`: a field name the frontend does not read would render
    // as nothing at all here, with no type error on either side of the boundary.
    expect(screen.getByText(file.modifiedAt)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(fileName);
  });

  test("shows the failing code and message and keeps the rows already listed", async () => {
    const user = userEvent.setup();
    readMock.mockResolvedValue(listing);
    writeMock.mockRejectedValue(new VaultCommandError("io", "The vault's files directory could not be written."));
    render(<StorageProbeCard />);

    expect(await screen.findByText(record.label)).toBeInTheDocument();

    await user.type(labelField(), "Smoke test");
    await user.click(writeButton());

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Storage probe failed (io)")).toBeInTheDocument();
    expect(within(alert).getByText("The vault's files directory could not be written.")).toBeInTheDocument();
    // A rejected write must not empty a listing that was correct a moment earlier.
    expect(screen.getByText(record.label)).toBeInTheDocument();
    expect(screen.getByText(fileName)).toBeInTheDocument();
  });

  test("renders the three resolved locations and an empty state before the first probe", async () => {
    render(<StorageProbeCard />);

    expect(await screen.findByText(paths.vaultRoot)).toBeInTheDocument();
    expect(screen.getByText(paths.dbPath)).toBeInTheDocument();
    expect(screen.getByText(paths.filesDir)).toBeInTheDocument();
    expect(screen.getByText(/no probe records yet/i)).toBeInTheDocument();
    expect(screen.getByText(/no probe files yet/i)).toBeInTheDocument();
  });
});

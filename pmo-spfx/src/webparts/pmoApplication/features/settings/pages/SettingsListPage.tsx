import * as React from "react";
import { PMO_CHOICES } from "../../../config/sharePointSchema";
import type { IPmoConfig } from "../../../models/domain";
import {
  EntityListPage,
  FilterBar,
  type IDataTableColumn,
} from "../../../components/composites";
import { ContentContainer } from "../../../components/layout";
import { SelectInput, StatusBadge } from "../../../components/primitives";
import { usePmoInteractions } from "../../../context/PmoApplicationContext";
import { usePmoServices } from "../../../context/PmoServicesContext";
import { usePmoCurrentUser } from "../../../hooks/usePmoCurrentUser";
import { toUserSafeErrorMessage } from "../../../utils/toUserSafeErrorMessage";
import type { IConfigListFilters } from "../../../services/domain";
import type { IPmoSettingDraft } from "../../../validation/configuration";
import { useSettingsPage } from "../hooks/useSettings";
import { SettingFormDialog } from "../components/SettingFormDialog";

const activeKey = (active: boolean | undefined): string =>
  active === undefined ? "all" : String(active);

export const SettingsListPage = (): React.ReactElement => {
  const { settings } = usePmoServices();
  const user = usePmoCurrentUser();
  const interactions = usePmoInteractions();
  const canManage = user.capabilities.indexOf("configuration.manage") >= 0;
  const [filters, setFilters] = React.useState<IConfigListFilters>({
    isActive: true,
  });
  const [searchValue, setSearchValue] = React.useState("");
  const page = useSettingsPage(settings, filters);
  const [editing, setEditing] = React.useState<IPmoConfig>();
  const [formOpen, setFormOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string>();
  const openForm = (setting?: IPmoConfig): void => {
    setEditing(setting);
    setFormError(undefined);
    setFormOpen(true);
  };
  const save = async (draft: IPmoSettingDraft): Promise<void> => {
    setSaving(true);
    setFormError(undefined);
    try {
      await settings.save(draft, editing);
      setFormOpen(false);
      page.reload();
      interactions.publishMessage({
        tone: "success",
        text: editing ? "Setting updated." : "Setting created.",
      });
    } catch (error) {
      setFormError(toUserSafeErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };
  const toggleActive = async (setting: IPmoConfig): Promise<void> => {
    const nextActive = !setting.isActive;
    const confirmed = await interactions.requestConfirmation({
      title: nextActive ? "Activate setting" : "Deactivate setting",
      message: `${nextActive ? "Activate" : "Deactivate"} ${setting.key}?`,
      confirmLabel: nextActive ? "Activate" : "Deactivate",
      destructive: !nextActive,
    });
    if (!confirmed) return;
    try {
      await settings.setActive(setting, nextActive);
      page.reload();
      interactions.publishMessage({
        tone: "success",
        text: `${setting.key} was ${nextActive ? "activated" : "deactivated"}.`,
      });
    } catch (error) {
      interactions.publishMessage({
        tone: "danger",
        text: toUserSafeErrorMessage(error),
      });
    }
  };
  const columns: readonly IDataTableColumn<IPmoConfig>[] = [
    {
      key: "key",
      header: "Setting",
      render: (item) => <strong>{item.key}</strong>,
    },
    { key: "category", header: "Category", render: (item) => item.category },
    { key: "value", header: "Value", render: (item) => item.value },
    {
      key: "description",
      header: "Description",
      render: (item) => item.description,
    },
    {
      key: "status",
      header: "Status",
      render: (item) => (
        <StatusBadge
          text={item.isActive ? "Active" : "Inactive"}
          tone={item.isActive ? "success" : "disabled"}
        />
      ),
    },
  ];
  return (
    <ContentContainer>
      <EntityListPage
        title="Configuration settings"
        subtitle="Search and maintain typed PMO configuration values."
        breadcrumbs={[{ text: "Settings" }, { text: "All settings" }]}
        ariaLabel="Configuration settings"
        items={page.items}
        columns={columns}
        getRowKey={(item) => String(item.id)}
        paging={{
          pageIndex: page.pageIndex,
          pageSize: page.pageSize,
          totalItems: page.totalItems,
        }}
        onPageChange={page.setPageIndex}
        loading={page.loading}
        errorMessage={page.error}
        onRetry={page.reload}
        onCreate={canManage ? () => openForm() : undefined}
        createLabel="Create setting"
        getRowActions={
          canManage
            ? (item) => [
                { key: "edit", label: "Edit", onClick: openForm },
                {
                  key: "active",
                  label: item.isActive ? "Deactivate" : "Activate",
                  onClick: toggleActive,
                },
              ]
            : undefined
        }
        filterSlot={
          <FilterBar
            searchLabel="Search settings"
            searchValue={searchValue}
            onSearchValueChange={setSearchValue}
            onSearch={(search) =>
              setFilters((current) => ({ ...current, search }))
            }
            controls={
              <>
                <SelectInput
                  label="Category"
                  value={filters.category ?? "all"}
                  options={[
                    { key: "all", text: "All categories" },
                    ...PMO_CHOICES.config.category.map((category) => ({
                      key: category,
                      text: category,
                    })),
                  ]}
                  onChange={(key) =>
                    setFilters((current) => ({
                      ...current,
                      category:
                        key === "all"
                          ? undefined
                          : (key as IPmoConfig["category"]),
                    }))
                  }
                />
                <SelectInput
                  label="Active"
                  value={activeKey(filters.isActive)}
                  options={[
                    { key: "true", text: "Active" },
                    { key: "false", text: "Inactive" },
                    { key: "all", text: "All" },
                  ]}
                  onChange={(key) =>
                    setFilters((current) => ({
                      ...current,
                      isActive: key === "all" ? undefined : key === "true",
                    }))
                  }
                />
              </>
            }
            activeFilterCount={
              Number(Boolean(filters.category)) +
              Number(filters.isActive !== undefined) +
              Number(Boolean(filters.search))
            }
            onClearAll={() => {
              setSearchValue("");
              setFilters({});
            }}
          />
        }
      />
      <SettingFormDialog
        open={formOpen}
        setting={editing}
        saving={saving}
        serverError={formError}
        onDismiss={() => setFormOpen(false)}
        onSave={(draft) => {
          save(draft).catch(() => undefined);
        }}
      />
    </ContentContainer>
  );
};

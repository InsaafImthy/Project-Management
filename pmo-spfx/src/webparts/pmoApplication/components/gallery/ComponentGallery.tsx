import * as React from "react";
import { Text } from "@fluentui/react";
import {
  ActionQueue,
  ActivityList,
  ChartCard,
  CommandBar,
  DashboardLayout,
  DashboardSection,
  DataTable,
  DescriptionList,
  EntityDetailLayout,
  EntityListPage,
  FilterBar,
  FilterChipList,
  FormActions,
  FormDialog,
  FormPanel,
  FormRow,
  FormSection,
  KpiCard,
  KpiGrid,
  ProgressSummary,
  QuickActions,
  SummaryCard,
  Timeline,
  ValidationSummary,
  type IDataTableColumn,
} from "../composites";
import {
  AccessDeniedPage,
  ContentContainer,
  PageHeader,
  Sidebar,
} from "../layout";
import {
  AppButton,
  AvatarName,
  CheckboxInput,
  DateDisplay,
  DateInput,
  DateTimeInput,
  Divider,
  EmptyState,
  ErrorState,
  FieldError,
  FieldHint,
  FieldLabel,
  Grid,
  HealthIndicator,
  HoursDisplay,
  IconButton,
  InlineMessage,
  LoadingSkeleton,
  LoadingSpinner,
  MoneyDisplay,
  NumberInput,
  PercentageDisplay,
  PersonInput,
  PriorityBadge,
  SearchInput,
  SelectInput,
  Stack,
  StatusBadge,
  TextArea,
  TextInput,
} from "../primitives";
import { primitiveStyles } from "../primitives/primitiveStyles";
import { PMO_NAVIGATION } from "../../routing/pmoRoutes";

interface IGalleryRecord {
  readonly id: string;
  readonly name: string;
  readonly owner: string;
  readonly status: string;
}

const galleryRecords: readonly IGalleryRecord[] = [
  {
    id: "1",
    name: "Migration readiness",
    owner: "Alex Morgan",
    status: "In review",
  },
  { id: "2", name: "Service launch", owner: "Casey Smith", status: "Active" },
];

const galleryColumns: readonly IDataTableColumn<IGalleryRecord>[] = [
  { key: "name", header: "Name", sortable: true, render: (item) => item.name },
  {
    key: "owner",
    header: "Owner",
    sortable: true,
    render: (item) => item.owner,
  },
  {
    key: "status",
    header: "Status",
    render: (item) => <StatusBadge text={item.status} />,
  },
];

const tableProps = {
  ariaLabel: "Gallery records",
  items: galleryRecords,
  columns: galleryColumns,
  getRowKey: (item: IGalleryRecord): string => item.id,
  paging: { pageIndex: 0, pageSize: 10, totalItems: galleryRecords.length },
  onPageChange: (): void => undefined,
};

/** Development-only visual contract for production primitives and composites. */
export const ComponentGallery = (): React.ReactElement => {
  const [text, setText] = React.useState("");
  const [number, setNumber] = React.useState<number | undefined>(25);
  const [checked, setChecked] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [panelOpen, setPanelOpen] = React.useState(false);

  return (
    <ContentContainer>
      <div className={primitiveStyles.gallery}>
        <PageHeader
          title="PMO component gallery"
          subtitle="Development-only states rendered with production tokens and components."
          breadcrumbs={[{ text: "Home" }, { text: "Gallery" }]}
        />

        <section className={primitiveStyles.gallerySection}>
          <Text as="h2" variant="xLarge">
            Actions and fields
          </Text>
          <Stack direction="horizontal" gap="sm" wrap>
            <AppButton variant="primary" text="Primary" />
            <AppButton variant="secondary" text="Secondary" />
            <AppButton variant="subtle" text="Subtle" />
            <AppButton variant="danger" text="Danger" />
            <IconButton
              ariaLabel="Open more actions"
              iconProps={{ iconName: "More" }}
            />
            <AppButton text="Disabled" disabled />
          </Stack>
          <Grid>
            <TextInput
              label="Project title"
              value={text}
              onChange={setText}
              hint="Use a concise working title."
            />
            <TextInput
              label="Invalid field"
              value=""
              errorMessage="A value is required."
              required
            />
            <TextArea label="Description" value={text} onChange={setText} />
            <NumberInput
              label="Completion"
              value={number}
              min={0}
              max={100}
              onChange={setNumber}
            />
            <DateInput label="Target date" value="2026-11-08" />
            <DateTimeInput label="Review time" value="2026-11-08T09:00" />
            <SelectInput
              label="Status"
              value="active"
              options={[{ key: "active", text: "Active" }]}
            />
            <CheckboxInput
              label="Include inactive records"
              checked={checked}
              onChange={setChecked}
            />
            <SearchInput label="Search records" onSearch={() => undefined} />
            <PersonInput
              label="Project manager"
              onResolveSuggestions={() => []}
            />
          </Grid>
          <FieldLabel>Standalone field anatomy</FieldLabel>
          <FieldHint>Hints explain valid input.</FieldHint>
          <FieldError>Errors explain how to recover.</FieldError>
        </section>

        <section className={primitiveStyles.gallerySection}>
          <Text as="h2" variant="xLarge">
            Status and display
          </Text>
          <Stack direction="horizontal" gap="sm" wrap>
            <StatusBadge text="Draft" />
            <StatusBadge text="Approved" tone="success" />
            <StatusBadge text="Attention" tone="warning" />
            <StatusBadge text="Failed" tone="danger" />
            <HealthIndicator value="Not Set" />
            <HealthIndicator value="Green" />
            <HealthIndicator value="Amber" />
            <HealthIndicator value="Red" />
            <PriorityBadge value="Low" />
            <PriorityBadge value="High" />
            <PriorityBadge value="Critical" />
          </Stack>
          <Divider />
          <Stack direction="horizontal" gap="lg" wrap>
            <AvatarName name="Example user" secondaryText="Project role" />
            <MoneyDisplay value={125000} currency="USD" />
            <HoursDisplay value={37.5} />
            <PercentageDisplay value={68} />
            <DateDisplay value="2026-11-08" locale="en-GB" />
          </Stack>
          <DescriptionList
            items={[
              { key: "owner", label: "Owner", value: "Example user" },
              {
                key: "updated",
                label: "Updated",
                value: <DateDisplay value="2026-11-08" />,
              },
            ]}
          />
        </section>

        <section className={primitiveStyles.gallerySection}>
          <Text as="h2" variant="xLarge">
            Data table states
          </Text>
          <Stack gap="lg">
            <DataTable
              {...tableProps}
              sort={{ key: "name", direction: "ascending" }}
              onSortChange={() => undefined}
              getRowActions={(item) => [
                {
                  key: "open",
                  label: `Open ${item.name}`,
                  onClick: () => undefined,
                },
              ]}
              filterSlot={
                <FilterBar
                  searchLabel="Search gallery records"
                  onSearch={() => undefined}
                />
              }
            />
            <DataTable {...tableProps} items={[]} loading />
            <DataTable {...tableProps} items={[]} />
            <DataTable
              {...tableProps}
              items={[]}
              errorMessage="Gallery records could not be loaded."
              onRetry={() => undefined}
            />
          </Stack>
        </section>

        <section className={primitiveStyles.gallerySection}>
          <Text as="h2" variant="xLarge">
            List and detail layouts
          </Text>
          <EntityListPage
            {...tableProps}
            title="Gallery list page"
            subtitle="Page header, filters, table, and create action use shared composition."
            createLabel="Create record"
            onCreate={() => undefined}
            filterSlot={
              <FilterChipList
                chips={[
                  { key: "active", label: "Active", onRemove: () => undefined },
                ]}
              />
            }
          />
          <EntityDetailLayout
            actions={
              <CommandBar>
                <AppButton text="Edit" />
              </CommandBar>
            }
            summary={
              <DescriptionList
                items={[
                  { key: "name", label: "Name", value: "Migration readiness" },
                ]}
              />
            }
            tabs={[
              {
                key: "history",
                label: "History",
                content: (
                  <Timeline
                    items={[
                      {
                        key: "1",
                        title: "Record created",
                        actor: "Example user",
                        timestamp: "Today",
                      },
                    ]}
                  />
                ),
              },
              {
                key: "activity",
                label: "Activity",
                content: (
                  <ActivityList
                    items={[
                      {
                        key: "1",
                        actor: "Example user",
                        summary: "Updated the record",
                        timestamp: "Today",
                      },
                    ]}
                  />
                ),
              },
            ]}
            relatedRecords={
              <SummaryCard title="Related records">
                No related records.
              </SummaryCard>
            }
          />
        </section>

        <section className={primitiveStyles.gallerySection}>
          <Text as="h2" variant="xLarge">
            Forms and validation
          </Text>
          <ValidationSummary
            issues={[
              {
                key: "name",
                message: "Project name is required.",
                fieldId: "gallery-project-name",
              },
            ]}
          />
          <FormSection
            title="Planning details"
            description="Form sections and rows adapt to available width."
          >
            <FormRow>
              <TextInput
                id="gallery-project-name"
                label="Project name"
                errorMessage="Project name is required."
              />
              <DateInput label="Planned start" />
            </FormRow>
          </FormSection>
          <FormActions>
            <AppButton text="Cancel" />
            <AppButton variant="primary" text="Save" />
          </FormActions>
          <Stack direction="horizontal" gap="sm">
            <AppButton
              text="Open dialog form"
              onClick={() => setDialogOpen(true)}
            />
            <AppButton
              text="Open panel form"
              onClick={() => setPanelOpen(true)}
            />
          </Stack>
          <FormDialog
            open={dialogOpen}
            title="Create record"
            onDismiss={() => setDialogOpen(false)}
            onSubmit={() => setDialogOpen(false)}
          >
            <TextInput label="Name" />
          </FormDialog>
          <FormPanel
            open={panelOpen}
            title="Edit planning details"
            onDismiss={() => setPanelOpen(false)}
            onSubmit={() => setPanelOpen(false)}
          >
            <TextArea label="Description" />
          </FormPanel>
        </section>

        <section className={primitiveStyles.gallerySection}>
          <Text as="h2" variant="xLarge">
            Dashboard system
          </Text>
          <DashboardLayout>
            <DashboardSection
              title="Portfolio signals"
              description="Every KPI can drill into filtered records."
            >
              <KpiGrid>
                <KpiCard
                  title="Active records"
                  value="24"
                  helpText="Current reporting period"
                  onDrillDown={() => undefined}
                />
                <KpiCard
                  title="Needs attention"
                  value="5"
                  onDrillDown={() => undefined}
                />
                <KpiCard
                  title="Completion"
                  value={<PercentageDisplay value={68} />}
                />
              </KpiGrid>
            </DashboardSection>
            <DashboardSection title="Progress and actions">
              <Grid>
                <SummaryCard title="Progress">
                  <ProgressSummary label="Plan complete" value={68} />
                </SummaryCard>
                <SummaryCard title="Action queue">
                  <ActionQueue
                    items={[
                      {
                        key: "review",
                        title: "Review requested",
                        detail: "Due today",
                        actionLabel: "Open",
                        onAction: () => undefined,
                      },
                    ]}
                  />
                </SummaryCard>
              </Grid>
              <QuickActions
                actions={[
                  {
                    key: "create",
                    label: "Create record",
                    onClick: () => undefined,
                  },
                ]}
              />
            </DashboardSection>
            <ChartCard
              title="Accessible chart slot"
              helpText="Chart renderers arrive with real dashboard requirements."
              dataTableFallback={<DataTable {...tableProps} />}
            >
              <div>Feature-supplied chart render slot</div>
            </ChartCard>
          </DashboardLayout>
        </section>

        <section className={primitiveStyles.gallerySection}>
          <Text as="h2" variant="xLarge">
            Navigation states
          </Text>
          <Grid>
            <Sidebar
              items={PMO_NAVIGATION.slice(0, 3)}
              capabilities={["work.view-own", "time.view-own"]}
              activeRoute="home"
              collapsed={false}
              onCollapsedChange={() => undefined}
              onNavigate={() => undefined}
            />
            <Sidebar
              items={PMO_NAVIGATION.slice(0, 3)}
              capabilities={["work.view-own", "time.view-own"]}
              activeRoute="my-work"
              collapsed
              onCollapsedChange={() => undefined}
              onNavigate={() => undefined}
            />
          </Grid>
        </section>

        <section className={primitiveStyles.gallerySection}>
          <Text as="h2" variant="xLarge">
            Feedback and permission states
          </Text>
          <Stack gap="md">
            <LoadingSpinner />
            <LoadingSkeleton />
            <EmptyState
              title="No records yet"
              description="Create the first record when you are ready."
            />
            <InlineMessage tone="success">The change was saved.</InlineMessage>
            <ErrorState
              message="The records could not be loaded."
              onRetry={() => undefined}
            />
            <AccessDeniedPage />
          </Stack>
        </section>
      </div>
    </ContentContainer>
  );
};

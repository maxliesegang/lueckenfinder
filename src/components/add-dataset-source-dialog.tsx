import {
  KernDialog,
  KernDialogBody,
  KernDialogHeader,
  KernDialogModal,
  KernDialogTrigger,
  useDialog,
} from "@kern-ux-annex/kern-react-kit";
import { useI18n } from "../hooks/use-i18n";
import type { DatasetDefinition } from "../types";
import { DatasetSourceForm } from "./dataset-source-form";

const ADD_DATASET_SOURCE_DIALOG_ID = "add-dataset-source-dialog";

interface AddDatasetSourceDialogProps {
  onSaveDefinition: (definition: DatasetDefinition) => boolean;
  onShareDefinition: (definition: DatasetDefinition) => void;
}

export function AddDatasetSourceDialog({
  onSaveDefinition,
  onShareDefinition,
}: AddDatasetSourceDialogProps) {
  const { t } = useI18n();

  return (
    <KernDialog id={ADD_DATASET_SOURCE_DIALOG_ID}>
      <KernDialogTrigger variant="secondary" icon="add" iconPosition="left" block>
        {t("controls.addSource")}
      </KernDialogTrigger>
      <KernDialogModal aria-labelledby={`${ADD_DATASET_SOURCE_DIALOG_ID}-title`}>
        <KernDialogHeader dialogTitle={t("controls.addSource")} showCloseButton />
        <KernDialogBody>
          <DatasetSourceDialogForm
            onSaveDefinition={onSaveDefinition}
            onShareDefinition={onShareDefinition}
          />
        </KernDialogBody>
      </KernDialogModal>
    </KernDialog>
  );
}

function DatasetSourceDialogForm({
  onSaveDefinition,
  onShareDefinition,
}: AddDatasetSourceDialogProps) {
  const { closeDialog, isOpen } = useDialog();

  function handleSave(definition: DatasetDefinition): boolean {
    const saved = onSaveDefinition(definition);
    if (saved) closeDialog();
    return saved;
  }

  return (
    <DatasetSourceForm
      open={isOpen}
      onSaveDefinition={handleSave}
      onShareDefinition={onShareDefinition}
      onCancel={closeDialog}
    />
  );
}

import {
  KernDialog,
  KernDialogBody,
  KernDialogHeader,
  KernDialogModal,
  KernDialogTrigger,
  useDialog,
} from "@kern-ux-annex/kern-react-kit";
import { useI18n } from "../hooks/use-i18n";
import type { PackLibrary } from "../packs";
import type { DatasetDefinition } from "../types";
import { CityPackForm } from "./city-pack-form";
import { DatasetSourceForm } from "./dataset-source-form";

const ADD_DATASET_SOURCE_DIALOG_ID = "add-dataset-source-dialog";

interface DatasetSourceFormProps {
  onSaveDefinition: (definition: DatasetDefinition) => boolean;
  onShareDefinition: (definition: DatasetDefinition) => void;
}

interface AddDatasetSourceDialogProps extends DatasetSourceFormProps {
  packLibrary: PackLibrary;
}

export function AddDatasetSourceDialog({
  onSaveDefinition,
  onShareDefinition,
  packLibrary,
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
          <CityPackForm packLibrary={packLibrary} />
          <hr className="dialog-section-divider" />
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
}: DatasetSourceFormProps) {
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

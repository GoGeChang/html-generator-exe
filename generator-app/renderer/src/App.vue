<template>
  <div class="app-shell">
    <t-card class="app-card" bordered>
      <template #title>静态站点 → Electron 应用生成器</template>

      <t-space direction="vertical" size="32px" class="full-width">
        <section>
          <div class="section-header">
            <h2>站点来源</h2>
            <p>拖放整个站点目录，或选择单个 HTML 文件快速生成。</p>
          </div>
          <div class="drop-wrapper">
            <div
              class="drop-zone"
              :class="{ 'is-hover': dropHover }"
              @click="handleChooseSource"
              @dragover.prevent="handleDragOver"
              @dragleave.prevent="handleDragLeave"
              @drop.prevent="handleDrop">
              <cloud-upload-icon size="32" />
              <div class="drop-texts">
                <p class="drop-title">拖放站点目录或 HTML 文件到此区域</p>
                <p class="drop-subtitle">或点击选择本地内容</p>
                <p v-if="sourcePath" class="drop-path">{{ sourcePath }}</p>
                <p v-else class="drop-placeholder">尚未选择目录或 HTML 文件</p>
              </div>
            </div>

            <t-input
              v-model="sourcePath"
              readonly
              placeholder="尚未选择目录或 HTML 文件"
              class="path-input"
              size="large">
              <template #suffix-icon>
                <folder-open-icon />
              </template>
            </t-input>

            <!-- <t-tag
              v-if="sourcePath"
              theme="primary"
              variant="light-outline"
              size="large"
              class="source-tag">
              {{ sourceKindLabel }}
            </t-tag>

            <t-button
              class="browse-btn"
              variant="outline"
              theme="default"
              size="large"
              @click="handleChooseSource">
              <template #icon>
                <folder-open-icon />
              </template>
              浏览目录 / HTML
            </t-button> -->
          </div>
        </section>

        <t-divider />

        <section>
          <h2 class="section-header">构建设置</h2>
          <t-form class="options-form" label-width="90px" colon>
            <t-form-item label="窗口标题">
              <t-input
                v-model="title"
                placeholder="我的静态站点"
                size="large"
                clearable />
            </t-form-item>

            <t-form-item label="目标平台">
              <t-radio-group
                v-model="platform"
                variant="default-filled"
                size="large"
                class="platform-group">
                <t-radio-button value="win">Windows EXE</t-radio-button>
                <t-radio-button value="mac">macOS DMG</t-radio-button>
              </t-radio-group>
            </t-form-item>

            <t-form-item v-if="platform === 'win'" label="CPU 架构">
              <t-radio-group
                v-model="winArch"
                variant="default-filled"
                size="large"
                class="platform-group">
                <t-radio-button value="x86">x86</t-radio-button>
                <t-radio-button value="arm">ARM</t-radio-button>
              </t-radio-group>
            </t-form-item>

            <t-form-item v-if="platform === 'win'" label="位数">
              <t-radio-group
                v-model="winBits"
                variant="default-filled"
                size="large"
                class="platform-group">
                <t-radio-button value="64">64 位</t-radio-button>
                <t-radio-button value="32" :disabled="winArch === 'arm'"
                  >32 位</t-radio-button
                >
              </t-radio-group>
              <p class="help-text">默认 x86 64 位，ARM 仅支持 64 位。</p>
            </t-form-item>

            <t-form-item label="图标文件">
              <div class="icon-row">
                <t-input
                  v-model="iconPath"
                  :placeholder="iconPlaceholder"
                  readonly
                  size="large">
                  <template #suffix-icon>
                    <image-icon />
                  </template>
                </t-input>
                <t-button
                  variant="outline"
                  size="large"
                  @click="handleChooseIcon">
                  选择图标
                </t-button>
              </div>
              <p class="help-text">{{ iconHelpText }}</p>
            </t-form-item>
          </t-form>
        </section>

        <section>
          <t-button
            theme="primary"
            size="large"
            block
            :disabled="!canBuild || isBuilding"
            :loading="isBuilding"
            @click="handleBuild">
            {{ buildButtonLabel }}
          </t-button>
          <t-alert
            v-if="status.message"
            :theme="status.theme"
            :message="status.message"
            class="status-alert" />
          <div
            v-if="showProgressLogs && progressLogs.length"
            class="progress-log-panel">
            <div
              v-for="(item, index) in progressLogs"
              :key="index"
              class="progress-log-line">
              <span class="progress-log-time" v-if="item.time">{{
                item.time
              }}</span>
              <span class="progress-log-step" v-if="item.step"
                >[{{ item.step }}]</span
              >
              <span class="progress-log-message">{{ item.message }}</span>
            </div>
          </div>
        </section>
      </t-space>
    </t-card>

    <t-dialog
      v-model:visible="chooseDialogVisible"
      header="请选择来源类型"
      :footer="false"
      :close-on-overlay-click="true"
      width="420px">
      <div class="choose-dialog">
        <p>请选择要打包的资源类型，然后继续。</p>
        <t-space direction="vertical" size="16px" class="choose-actions">
          <t-button
            theme="primary"
            size="large"
            block
            :loading="isChoosingSource"
            @click="performChooseSource('directory')">
            选择站点目录
          </t-button>
          <t-button
            theme="default"
            size="large"
            block
            :loading="isChoosingSource"
            @click="performChooseSource('html')">
            选择 HTML 文件
          </t-button>
        </t-space>
      </div>
    </t-dialog>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch, onMounted } from "vue";
import {
  CloudUploadIcon,
  FolderOpenIcon,
  ImageIcon,
} from "tdesign-icons-vue-next";

import { electronAPI } from "../renderer.js";

const title = ref("我的静态站点");
const sourcePath = ref("");
const sourceIsDirectory = ref(true);
const iconPath = ref("");
const platform = ref("win");
const winArch = ref("x86");
const winBits = ref("64");
const isBuilding = ref(false);
const dropHover = ref(false);
const chooseDialogVisible = ref(false);
const isChoosingSource = ref(false);
const status = reactive({
  message: "",
  theme: "info",
});

const progressLogs = ref([]);
const currentStep = ref("");

const platformLabelMap = {
  win: "Windows EXE",
  mac: "macOS 安装包",
};

const isWindowsTarget = computed(() => platform.value === "win");

watch(winArch, (value) => {
  if (value === "arm") {
    winBits.value = "64";
  }
});

watch(winBits, (value) => {
  if (value === "32" && winArch.value === "arm") {
    winArch.value = "x86";
  }
});

const targetLabel = computed(() => {
  if (isWindowsTarget.value) {
    const archLabel = winArch.value === "arm" ? "ARM" : "x86";
    const bitsLabel = winBits.value === "32" ? "32 位" : "64 位";
    return `Windows ${archLabel.toUpperCase()} ${bitsLabel}`;
  }
  return platformLabelMap[platform.value] || "应用";
});

const buildButtonLabel = computed(() => `生成 ${targetLabel.value}`);

const iconHelpText = computed(() =>
  platform.value === "mac"
    ? "可选，建议提供 1024×1024 的 .icns 图标，用于 macOS 应用。"
    : "可选，建议提供 256×256 的 .ico 图标，用于 Windows EXE。"
);

const iconPlaceholder = computed(() =>
  platform.value === "mac" ? "支持 *.icns / *.png" : "支持 *.ico / *.png"
);

const sourceKindLabel = computed(() => {
  if (!sourcePath.value) return "";
  return sourceIsDirectory.value ? "目录" : "HTML 文件";
});

const canBuild = computed(
  () => Boolean(sourcePath.value && title.value.trim()) && !isBuilding.value
);

const showProgressLogs = computed(
  () => progressLogs.value.length > 0 || isBuilding.value
);

function setStatus(message, theme = "info") {
  status.message = message;
  status.theme = theme;
}

function applySourceSelection(path, isDirectory) {
  sourcePath.value = path;
  sourceIsDirectory.value = isDirectory;
}

function handleChooseSource() {
  chooseDialogVisible.value = true;
}

async function performChooseSource(mode) {
  chooseDialogVisible.value = false;
  await triggerSystemChoose(mode);
}

async function triggerSystemChoose(mode = "auto") {
  if (isChoosingSource.value) return;
  isChoosingSource.value = true;
  try {
    const result = await electronAPI.chooseFolder({
      startDir: sourcePath.value || undefined,
      mode,
    });
    if (result?.canceled) return;
    if (result?.error) {
      setStatus(result.error, "error");
      return;
    }
    const pickedPath = result?.sourcePath || result?.folderPath;
    if (!pickedPath) return;
    applySourceSelection(
      pickedPath,
      result?.isDirectory !== false ? true : false
    );
    setStatus(
      `已选择${sourceIsDirectory.value ? "目录" : "HTML"}：${pickedPath}`,
      "success"
    );
  } catch (error) {
    setStatus(`选择来源失败：${error.message || error}`, "error");
  } finally {
    isChoosingSource.value = false;
  }
}

async function handleDrop(event) {
  dropHover.value = false;
  const files = Array.from(event.dataTransfer?.files || []);
  const candidatePaths = files.map((file) => file.path).filter(Boolean);
  if (!candidatePaths.length) {
    setStatus("未检测到有效文件，请再次尝试", "warning");
    return;
  }
  try {
    const result = await electronAPI.ensureFolderPaths(candidatePaths);
    const entry =
      result?.entries?.[0] ??
      (result?.folders?.length
        ? { path: result.folders[0], isDirectory: true }
        : null);
    if (entry?.path) {
      applySourceSelection(entry.path, entry.isDirectory !== false);
      setStatus(
        `已选择${entry.isDirectory !== false ? "目录" : "HTML"}：${entry.path}`,
        "success"
      );
    } else {
      setStatus("请拖入文件夹或 HTML 文件（*.html, *.htm）", "warning");
    }
  } catch (error) {
    setStatus(`读取拖入内容失败：${error.message || error}`, "error");
  }
}

function handleDragOver() {
  dropHover.value = true;
}

function handleDragLeave() {
  dropHover.value = false;
}

async function handleChooseIcon() {
  try {
    const result = await electronAPI.chooseIcon();
    if (result?.canceled || !result?.filePath) return;
    iconPath.value = result.filePath;
    setStatus(`已选择图标：${result.filePath}`, "success");
  } catch (error) {
    setStatus(`选择图标失败：${error.message || error}`, "error");
  }
}

onMounted(() => {
  if (electronAPI && typeof electronAPI.onBuildProgress === "function") {
    electronAPI.onBuildProgress((payload) => {
      if (!payload) return;
      const { step, message, timestamp } = payload;
      const timeLabel = timestamp
        ? new Date(timestamp).toLocaleTimeString()
        : "";

      currentStep.value = step || "";
      // 根据不同阶段设置提示主题
      let theme = "info";
      if (step === "success") theme = "success";
      else if (step === "error") theme = "error";

      if (message) {
        setStatus(message, theme);
      }

      if (message) {
        progressLogs.value.push({
          step: step || "",
          message,
          time: timeLabel,
        });
      }
    });
  }
});

async function handleBuild() {
  if (!sourcePath.value) {
    setStatus("请先选择目录或 HTML 文件", "warning");
    return;
  }

  progressLogs.value = [];
  currentStep.value = "";

  isBuilding.value = true;
  const currentPlatform = platform.value;
  const platformLabel = targetLabel.value;
  setStatus(`正在生成 ${platformLabel}，请稍候…`, "info");

  try {
    const response = await electronAPI.buildFromFolder({
      folderPath: sourcePath.value,
      sourcePath: sourcePath.value,
      title: title.value.trim() || "我的静态站点",
      iconPath: iconPath.value || null,
      platform: currentPlatform,
      winArch: winArch.value,
      winBits: winBits.value,
      sourceType: sourceIsDirectory.value ? "directory" : "html",
    });

    if (response?.success) {
      setStatus(
        `生成成功（${platformLabel}），输出路径：${response.outputPath}`,
        "success"
      );
    } else {
      setStatus(response?.error || "未知错误", "error");
    }
  } catch (error) {
    setStatus(`构建失败：${error.message || error}`, "error");
  } finally {
    isBuilding.value = false;
  }
}
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  background: linear-gradient(135deg, #f4f6fb 0%, #ffffff 60%, #f8fbff 100%);
  padding: 40px 20px;
  display: flex;
  justify-content: center;
  font-family: "SF Pro Display", "PingFang SC", "Microsoft YaHei", sans-serif;
}

.app-card {
  max-width: 960px;
  width: 100%;
  box-shadow: 0 20px 45px rgba(15, 26, 67, 0.08);
}

.full-width {
  width: 100%;
}

.section-header {
  margin-bottom: 12px;
}

.section-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #151a30;
}

.section-header p {
  margin: 4px 0 0;
  color: #6c738c;
  font-size: 14px;
}

.drop-wrapper {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.drop-zone {
  border: 2px dashed #c5d2f1;
  border-radius: 16px;
  padding: 28px;
  background: #f7f9ff;
  display: flex;
  gap: 20px;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
  align-items: center;
}

.drop-zone :deep(svg) {
  color: #0052d9;
}

.drop-zone.is-hover {
  border-color: #0052d9;
  background: #eef4ff;
  transform: translateY(-2px);
}

.drop-texts {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.drop-title {
  margin: 0;
  font-weight: 600;
  font-size: 16px;
}

.drop-subtitle {
  margin: 0;
  font-size: 14px;
  color: #6c738c;
}

.drop-path {
  margin: 6px 0 0;
  font-family: "JetBrains Mono", Consolas, monospace;
  font-size: 13px;
  word-break: break-all;
  color: #2f334d;
}

.drop-placeholder {
  margin: 6px 0 0;
  color: #9aa0b5;
  font-size: 13px;
}

.path-input :deep(input) {
  font-family: "JetBrains Mono", Consolas, monospace;
}

.source-tag {
  align-self: flex-start;
}

.browse-btn {
  align-self: flex-start;
}

.options-form {
  margin-top: 8px;
}

.platform-group {
  display: flex;
  gap: 12px;
}

.platform-group :deep(.t-radio-button) {
  flex: 1;
  text-align: center;
}

.icon-row {
  display: flex;
  gap: 12px;
  width: 100%;
}

.icon-row .t-input {
  flex: 1;
}

.help-text {
  margin: 6px 0 0;
  margin-left: 15px;
  color: #949ab4;
  font-size: 12px;
}

.status-alert {
  margin-top: 16px;
}

.choose-dialog {
  padding: 8px 0 4px;
}

.choose-dialog p {
  margin: 0 0 12px;
  color: #6c738c;
}

.choose-actions {
  width: 100%;
}

.progress-log-panel {
  margin-top: 12px;
  max-height: 180px;
  overflow-y: auto;
  padding: 8px 10px;
  border-radius: 8px;
  background: #f5f7ff;
  border: 1px solid #d4ddff;
}

.progress-log-line {
  font-size: 12px;
  color: #4b5168;
  line-height: 1.6;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.progress-log-time {
  color: #a0a6c3;
  font-family: "JetBrains Mono", Consolas, monospace;
}

.progress-log-step {
  font-weight: 600;
  color: #0052d9;
}

.progress-log-message {
  flex: 1;
}

@media (max-width: 640px) {
  .icon-row {
    flex-direction: column;
  }

  .drop-zone {
    flex-direction: column;
    text-align: center;
  }
}
</style>

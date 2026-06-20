const NODE_ICON_MAP = {
  anchor: "",
  start: "",
  everest: "/assets/learning-path/icon/icon-everest.png.jpg",
  elbrus: "/assets/learning-path/icon/icon-elbrus.png.jpg",
  kilimanjaro: "/assets/learning-path/icon/icon-kilimanjaro.png.jpg",
  denali: "/assets/learning-path/icon/icon-denali.png.jpg",
  aconcagua: "/assets/learning-path/icon/icon-aconcagua.png.jpg",
  "puncak-jaya": "/assets/learning-path/icon/icon-puncak-jaya.png.jpg",
  "vinson-massif": "/assets/learning-path/icon/icon-vinson-massif.png.jpg",
};

function cloneValue(value) {
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      // Fall back to JSON serialization below.
    }
  }

  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function uniqueByCheckpointId(nodes) {
  const seen = new Set();
  const uniqueNodes = [];

  (Array.isArray(nodes) ? nodes : []).forEach((node) => {
    const checkpointId = String(node?.checkpointId || node?.id || "").trim();
    if (!checkpointId || seen.has(checkpointId)) {
      return;
    }

    seen.add(checkpointId);
    uniqueNodes.push({ ...node, checkpointId });
  });

  const startNodeIndex = uniqueNodes.findIndex((node) => node.checkpointId === "start");
  if (startNodeIndex > 0) {
    const [startNode] = uniqueNodes.splice(startNodeIndex, 1);
    uniqueNodes.unshift(startNode);
  }

  return uniqueNodes;
}

function hashString(input) {
  let hash = 0;
  const text = String(input || "");

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

export function getNodeIcon(type) {
  return NODE_ICON_MAP[String(type || "").trim().toLowerCase()] || "";
}

function getCurrentMountain(state) {
  return state?.mountain || state?.season?.mountains?.[0] || null;
}

function getCheckpointPosition(checkpoint) {
  const position = checkpoint?.position || {};
  return {
    x: Number(position.left ?? position.x ?? 0),
    y: Number(position.top ?? position.y ?? 0),
    side: String(position.side || "left"),
  };
}

function getStartCheckpoint(state, mountain) {
  const checkpoints = Array.isArray(mountain?.checkpoints) ? mountain.checkpoints : [];
  return checkpoints.find((checkpoint) => String(checkpoint?.id || "") === "start") || null;
}

function buildNodeFromCheckpoint(checkpoint, index) {
  const checkpointId = String(checkpoint?.id || checkpoint?.checkpointId || "").trim();
  const nodeType = checkpointId === "start" ? "anchor" : String(checkpoint?.type || "station").trim() || "station";
  const iconType = String(checkpoint?.mountainId || checkpoint?.id || nodeType).trim().toLowerCase();
  const position = getCheckpointPosition(checkpoint);
  const status = String(checkpoint?.status || checkpoint?.state || "locked").toLowerCase();

  return {
    checkpointId,
    id: checkpointId,
    order: Number.isFinite(Number(checkpoint?.checkpointIndex)) ? Number(checkpoint.checkpointIndex) : index,
    type: nodeType,
    title: String(checkpoint?.title || ""),
    altitude: String(checkpoint?.altitude || ""),
    mountainId: String(checkpoint?.mountainId || ""),
    iconType,
    status,
    position,
    checkpoint: cloneValue(checkpoint),
  };
}

export function createGraphState(state) {
  const mountain = getCurrentMountain(state);
  const rawNodes = [];

  const startCheckpoint = getStartCheckpoint(state, mountain);
  if (startCheckpoint) {
    rawNodes.push(startCheckpoint);
  } else {
    rawNodes.push({
      id: "start",
      checkpointId: "start",
      type: "anchor",
      title: "Điểm xuất phát",
      altitude: "0 m",
      status: "current",
      mountainId: String(mountain?.id || ""),
      position: {
        left: Number(state?.startPosition?.left ?? state?.avatar?.position?.left ?? 0),
        top: Number(state?.startPosition?.top ?? state?.avatar?.position?.top ?? 0),
        side: String(state?.startPosition?.side || "left"),
      },
    });
  }

  const mountainCheckpoints = Array.isArray(mountain?.checkpoints) ? mountain.checkpoints : [];
  mountainCheckpoints.forEach((checkpoint) => {
    rawNodes.push(checkpoint);
  });

  const dedupedCheckpoints = uniqueByCheckpointId(rawNodes);
  const nodes = new Map();
  const layout = new Map();

  dedupedCheckpoints.forEach((checkpoint, index) => {
    const node = buildNodeFromCheckpoint(checkpoint, index);
    nodes.set(node.checkpointId, node);
    layout.set(node.checkpointId, {
      x: node.position.x,
      y: node.position.y,
      side: node.position.side,
    });
  });

  if (!nodes.has("start")) {
    const startNode = buildNodeFromCheckpoint(
      {
        id: "start",
        checkpointId: "start",
        type: "anchor",
        title: "Điểm xuất phát",
        altitude: "0 m",
        status: "current",
        mountainId: String(mountain?.id || ""),
        position: {
          left: Number(state?.startPosition?.left ?? state?.avatar?.position?.left ?? 0),
          top: Number(state?.startPosition?.top ?? state?.avatar?.position?.top ?? 0),
          side: String(state?.startPosition?.side || "left"),
        },
      },
      0,
    );
    nodes.set("start", startNode);
    layout.set("start", {
      x: startNode.position.x,
      y: startNode.position.y,
      side: startNode.position.side,
    });
  }

  const orderedNodeIds = Array.from(nodes.keys());
  const edges = orderedNodeIds.slice(1).map((checkpointId, index) => ({
    from: orderedNodeIds[index],
    to: checkpointId,
  }));

  const currentCheckpointId = state?.currentCheckpointId === null
    ? "start"
    : String(state?.currentCheckpointId || state?.checkpointId || "start").trim() || "start";
  const avatarCheckpointId = nodes.has(currentCheckpointId) ? currentCheckpointId : "start";
  const avatarPosition = layout.get(avatarCheckpointId) || layout.get("start") || { x: 0, y: 0, side: "left" };
  const serializableNodes = Array.from(nodes.values()).map((node) => ({
    checkpointId: node.checkpointId,
    type: node.type,
    title: node.title,
    altitude: node.altitude,
    status: node.status,
    x: node.position.x,
    y: node.position.y,
    side: node.position.side,
  }));

  return {
    nodes,
    edges,
    layout,
    avatar: {
      currentCheckpointId: avatarCheckpointId,
      position: {
        x: avatarPosition.x,
        y: avatarPosition.y,
      },
    },
    version: hashString(JSON.stringify({
      currentMountainId: String(state?.currentMountainId || mountain?.id || ""),
      currentCheckpointId: avatarCheckpointId,
      nodes: serializableNodes,
      edges,
    })),
  };
}

export function diffGraphState(previousState, nextState) {
  return {
    versionChanged: !previousState || previousState.version !== nextState.version,
    avatarChanged:
      !previousState ||
      previousState.avatar?.currentCheckpointId !== nextState.avatar?.currentCheckpointId ||
      previousState.avatar?.position?.x !== nextState.avatar?.position?.x ||
      previousState.avatar?.position?.y !== nextState.avatar?.position?.y,
  };
}

function createCheckpointButton(node) {
  const button = document.createElement("button");
  const isLocked = node.status === "locked";
  const isCurrent = node.status === "current";

  button.type = "button";
  button.className = [
    "learning-path-station-checkpoint",
    "learning-path-station-checkpoint-button",
    isCurrent ? "is-current" : "",
    isLocked ? "is-locked" : "",
    node.status === "completed" ? "is-completed" : "",
  ]
    .filter(Boolean)
    .join(" ");
  button.dataset.checkpoint = node.checkpointId;
  button.dataset.learningPathCheckpoint = node.checkpointId;
  button.dataset.learningPathOpenCheckpoint = "true";
  button.setAttribute("aria-label", node.checkpointId === "start" ? "Mở điểm xuất phát" : `Mở nhiệm vụ ${node.title}`);

  if (isLocked) {
    button.setAttribute("aria-hidden", "true");
    button.classList.add("is-locked");
  } else if (node.status === "completed") {
    const badge = document.createElement("span");
    badge.className = "learning-path-station-status-badge";
    badge.innerHTML = `
      <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
        <path
          d="M20 6.5 9.75 17.2 4 11.75"
          fill="none"
          stroke="currentColor"
          stroke-width="2.4"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    `;
    button.appendChild(badge);
  }

  return button;
}

function createGraphNodeElement(node) {
  if (node.checkpointId === "start") {
    const startNode = document.createElement("div");
    startNode.className = "learning-path-start-node";
    startNode.style.left = `${node.position.x}%`;
    startNode.style.top = `${node.position.y}%`;

    const anchor = document.createElement("button");
    anchor.type = "button";
    anchor.className = "learning-path-start-anchor learning-path-start-anchor-button";
    anchor.dataset.checkpoint = "start";
    anchor.dataset.learningPathCheckpoint = "start";
    anchor.dataset.learningPathOpenCheckpoint = "true";
    anchor.setAttribute("aria-label", "Mở điểm xuất phát");
    anchor.innerHTML = '<span class="learning-path-start-marker">0m</span>';

    const copy = document.createElement("div");
    copy.className = "learning-path-start-copy";
    const startTitle = document.createElement("strong");
    startTitle.textContent = "Điểm xuất phát";
    const startAltitude = document.createElement("span");
    startAltitude.textContent = "0 m";
    copy.append(startTitle, startAltitude);

    startNode.append(anchor, copy);
    return startNode;
  }

  const isSummit = node.type === "summit";
  const station = document.createElement("div");
  station.className = [
    isSummit ? "learning-path-peak" : "learning-path-station",
    node.position.side === "right" ? "is-right" : "is-left",
    node.status === "current" ? "is-current" : node.status === "completed" ? "is-completed" : "is-locked",
  ]
    .filter(Boolean)
    .join(" ");
  station.style.left = `${node.position.x}%`;
  station.style.top = `${node.position.y}%`;

  const anchor = document.createElement("div");
  anchor.className = "learning-path-station-anchor";
  anchor.appendChild(createCheckpointButton(node));

  const copy = document.createElement("div");
  copy.className = isSummit ? "learning-path-peak-copy" : "learning-path-station-copy";
  const titleEl = document.createElement("strong");
  titleEl.textContent = node.title;
  const altitudeEl = document.createElement("span");
  altitudeEl.textContent = node.altitude;
  copy.append(titleEl, altitudeEl);

  if (isSummit) {
    const subtitleEl = document.createElement("small");
    subtitleEl.textContent = "Hoàn thành để nhận huy hiệu";
    copy.appendChild(subtitleEl);
  }

  station.append(anchor, copy);
  return station;
}

function ensureAvatarLayer(root) {
  let avatarLayer = root.querySelector("#graph-avatar-layer");
  if (avatarLayer) {
    return avatarLayer;
  }

  avatarLayer = document.createElement("div");
  avatarLayer.id = "graph-avatar-layer";
  avatarLayer.className = "learning-path-avatar-layer";
  avatarLayer.setAttribute("aria-hidden", "true");
  avatarLayer.innerHTML = `
    <span class="learning-path-station-avatar learning-path-avatar-attached" data-learning-path-avatar aria-hidden="true">
      <img src="/assets/userAvatar/boy.png" alt="" loading="lazy" decoding="async" />
    </span>
  `;
  return avatarLayer;
}

export function renderGraphV3(root, graphState, { modalOpen = false } = {}) {
  if (!root) {
    return null;
  }

  const graphViewport = root.querySelector("[data-learning-path-graph-viewport]");
  const nodeLayer = root.querySelector("[data-learning-path-graph-nodes]");
  if (!graphViewport || !nodeLayer) {
    return null;
  }

  const existingVersion = nodeLayer.dataset.graphVersion || "";
  const nextVersion = String(graphState.version || "");

  if (existingVersion !== nextVersion) {
    const fragment = document.createDocumentFragment();
    graphState.nodes.forEach((node) => {
      fragment.appendChild(createGraphNodeElement(node));
    });

    nodeLayer.replaceChildren(fragment);
    nodeLayer.dataset.graphVersion = nextVersion;
  }

  const avatarLayer = ensureAvatarLayer(graphViewport);
  const currentAvatarLayer = graphViewport.querySelector("#graph-avatar-layer");
  if (!currentAvatarLayer) {
    graphViewport.appendChild(avatarLayer);
  }

  const avatar = graphState.avatar;
  const avatarNode = graphState.nodes.get(avatar.currentCheckpointId) || graphState.nodes.get("start") || null;
  const resolvedPosition = avatarNode ? avatarNode.position : { x: 0, y: 0 };
  avatarLayer.style.left = `${resolvedPosition.x}%`;
  avatarLayer.style.top = `${resolvedPosition.y}%`;
  avatarLayer.dataset.checkpoint = avatar.currentCheckpointId;
  avatarLayer.style.opacity = avatar.currentCheckpointId ? "1" : "0";
  avatarLayer.style.pointerEvents = "none";

  graphViewport.inert = Boolean(modalOpen);

  return avatarLayer;
}

export function updateAvatarPosition(root, graphState) {
  if (!root) {
    return null;
  }

  const avatarLayer = root.querySelector("#graph-avatar-layer");
  if (!avatarLayer) {
    return renderGraphV3(root, graphState);
  }

  const avatarNode = graphState.nodes.get(graphState.avatar.currentCheckpointId) || graphState.nodes.get("start") || null;
  const resolvedPosition = avatarNode ? avatarNode.position : { x: 0, y: 0 };
  avatarLayer.style.left = `${resolvedPosition.x}%`;
  avatarLayer.style.top = `${resolvedPosition.y}%`;
  avatarLayer.dataset.checkpoint = graphState.avatar.currentCheckpointId;
  avatarLayer.style.opacity = graphState.avatar.currentCheckpointId ? "1" : "0";
  return avatarLayer;
}

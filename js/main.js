// js/main.js
console.log("--- main.js script started ---");

document.addEventListener("DOMContentLoaded", async () => {
  console.log("--- DOMContentLoaded event fired ---");

  // --- DOM Element Cache ---
  const svgNS = "http://www.w3.org/2000/svg";
  const svgElement = document.getElementById("family-tree-svg");
  const sidebar = document.getElementById("sidebar");
  const closeSidebarButton = document.getElementById("close-sidebar");

  const settingsIcon = document.getElementById("settings-icon");
  const settingsMenu = document.getElementById("settings-menu");
  const closeSettingsMenuButton = document.getElementById(
    "close-settings-menu"
  );

  const particleCountSlider = document.getElementById("particle-count-slider");
  const particleCountValueDisplay = document.getElementById(
    "particle-count-value"
  );
  const gradientSpeedSlider = document.getElementById("gradient-speed-slider");
  const gradientSpeedValueDisplay = document.getElementById(
    "gradient-speed-value"
  );
  const particleSpeedSlider = document.getElementById("particle-speed-slider");
  const particleSpeedValueDisplay = document.getElementById(
    "particle-speed-value"
  );
  const connectToMouseCheckbox = document.getElementById(
    "connect-to-mouse-checkbox"
  );
  const repulseMouseCheckbox = document.getElementById(
    "repulse-mouse-checkbox"
  );

  // --- Configuration Constants ---
  const NODE_RADIUS = 30;
  const NAME_OFFSET_Y = 15;
  const HORIZONTAL_SPACING_PARTNERS = NODE_RADIUS * 2 + 60;
  const HORIZONTAL_SPACING_SIBLINGS = NODE_RADIUS * 2 + 30;
  const VERTICAL_SPACING_GENERATIONS = NODE_RADIUS * 2 + 80;
  const SPOUSE_LINE_MARGIN = 5;
  const CHILD_H_LINE_Y_OFFSET = 75;
  const TARGET_ZOOM_LEVEL = 2;
  const SVG_WIDTH = 3000;
  const SVG_HEIGHT = 2000;

  // --- State Variables ---
  let familyData = [];
  let membersMap = new Map();
  let panZoomInstance;
  let tsParticlesInstance;
  let gradientAnimationSpeed =
    0.0005 *
    (gradientSpeedSlider ? parseInt(gradientSpeedSlider.value, 10) : 5);

  let isUserPotentiallyPanning = false; // True on mousedown/touchstart on SVG
  let panOccurredSinceMousedown = false; // True if onPan/beforePan fired after potential pan start

  // --- Initial Setup ---
  if (svgElement) {
    svgElement.setAttribute("width", SVG_WIDTH);
    svgElement.setAttribute("height", SVG_HEIGHT);
    svgElement.setAttribute("viewBox", `0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`);
  }

  // --- Gradient Animation ---
  const gradientColors = [
    { r: 10, g: 25, b: 47 },
    { r: 17, g: 34, b: 64 },
    { r: 23, g: 42, b: 69 },
    { r: 10, g: 45, b: 67 },
  ];
  let currentGradientSet = [0, 1, 2];
  let gradientTransitionProgress = 0;

  function updateGradientColors() {
    gradientTransitionProgress += gradientAnimationSpeed;
    if (gradientTransitionProgress >= 1) {
      gradientTransitionProgress = 0;
      currentGradientSet = [
        currentGradientSet[1],
        currentGradientSet[2],
        (currentGradientSet[2] + 1) % gradientColors.length,
      ];
    }
    const [c1_base, c2_base, c3_base] = currentGradientSet.map(
      (i) => gradientColors[i]
    );
    const [c1_target, c2_target, c3_target] = [
      currentGradientSet[1],
      currentGradientSet[2],
      (currentGradientSet[2] + 1) % gradientColors.length,
    ].map((i) => gradientColors[i]);
    const lerp = (start, end, t) => Math.round(start + (end - start) * t);
    document.documentElement.style.setProperty(
      "--gradient-color-1",
      `rgb(${lerp(c1_base.r, c1_target.r, gradientTransitionProgress)},${lerp(
        c1_base.g,
        c1_target.g,
        gradientTransitionProgress
      )},${lerp(c1_base.b, c1_target.b, gradientTransitionProgress)})`
    );
    document.documentElement.style.setProperty(
      "--gradient-color-2",
      `rgb(${lerp(c2_base.r, c2_target.r, gradientTransitionProgress)},${lerp(
        c2_base.g,
        c2_target.g,
        gradientTransitionProgress
      )},${lerp(c2_base.b, c2_target.b, gradientTransitionProgress)})`
    );
    document.documentElement.style.setProperty(
      "--gradient-color-3",
      `rgb(${lerp(c3_base.r, c3_target.r, gradientTransitionProgress)},${lerp(
        c3_base.g,
        c3_target.g,
        gradientTransitionProgress
      )},${lerp(c3_base.b, c3_target.b, gradientTransitionProgress)})`
    );
    requestAnimationFrame(updateGradientColors);
  }

  // --- Particle Configuration & Initialization ---
  function getParticleOptions() {
    const count = particleCountSlider
      ? parseInt(particleCountSlider.value, 10)
      : 100;
    const speed = particleSpeedSlider
      ? parseFloat(particleSpeedSlider.value)
      : 0.5;
    const connectToMouse = connectToMouseCheckbox
      ? connectToMouseCheckbox.checked
      : true;
    const repulseMouse = repulseMouseCheckbox
      ? repulseMouseCheckbox.checked
      : false;
    let hoverMode = [];
    if (connectToMouse) hoverMode.push("grab");
    if (repulseMouse) hoverMode.push("repulse");

    return {
      fpsLimit: 60,
      interactivity: {
        events: {
          onHover: { enable: connectToMouse || repulseMouse, mode: hoverMode },
          onClick: { enable: false }, // BUG FIX: Particles don't spawn on click
          resize: true,
        },
        modes: {
          grab: { distance: 180, links: { opacity: 0.8, color: "#64ffda" } },
          repulse: {
            distance: 100,
            duration: 0.4,
            speed: 1,
            easing: "ease-out-quad",
          },
          push: { quantity: 3 }, // Still defined, but not used by onClick
          bubble: { distance: 200, size: 20, duration: 0.4 },
        },
      },
      particles: {
        color: { value: "#64ffda" },
        links: {
          color: "#64ffda",
          distance: 150,
          enable: true,
          opacity: 0.12,
          width: 1,
        },
        collisions: { enable: false },
        move: {
          direction: "none",
          enable: true,
          outModes: { default: "bounce" },
          random: true,
          speed: speed,
          straight: false,
        },
        number: { density: { enable: true, area: 800 }, value: count },
        opacity: {
          value: { min: 0.1, max: 0.4 },
          animation: { enable: true, speed: 0.8, minimumValue: 0.05 },
        },
        shape: { type: "circle" },
        size: {
          value: { min: 0.5, max: 2.5 },
          animation: { enable: true, speed: 2.5, minimumValue: 0.2 },
        },
      },
      detectRetina: true,
      background: { color: "transparent" },
    };
  }

  async function refreshParticles() {
    if (window.tsParticles) {
      if (
        tsParticlesInstance &&
        typeof tsParticlesInstance.destroy === "function"
      ) {
        tsParticlesInstance.destroy();
      } else if (
        window.tsParticles.dom &&
        window.tsParticles.dom().length > 0
      ) {
        window.tsParticles.domItem(0)?.destroy();
      }
      try {
        const options = getParticleOptions();
        tsParticlesInstance = await tsParticles.load(
          "particles-container",
          options
        );
        console.log(
          "tsParticles loaded/reloaded. Count:",
          options.particles.number.value,
          "Speed:",
          options.particles.move.speed,
          "HoverMode:",
          options.interactivity.events.onHover.mode
        );
      } catch (error) {
        console.error("Error loading tsParticles:", error);
      }
    }
  }

  // --- Settings Menu Logic ---
  function setupSettingsMenuEventListeners() {
    if (
      !settingsIcon ||
      !settingsMenu ||
      !closeSettingsMenuButton ||
      !particleCountSlider ||
      !particleCountValueDisplay ||
      !gradientSpeedSlider ||
      !gradientSpeedValueDisplay ||
      !particleSpeedSlider ||
      !particleSpeedValueDisplay ||
      !connectToMouseCheckbox ||
      !repulseMouseCheckbox
    ) {
      console.warn(
        "One or more settings UI elements are missing for event listener setup."
      );
    }

    if (settingsIcon && settingsMenu) {
      settingsIcon.addEventListener("click", (e) => {
        e.stopPropagation();
        settingsMenu.classList.toggle("settings-menu-visible");
      });
    }
    if (closeSettingsMenuButton && settingsMenu) {
      closeSettingsMenuButton.addEventListener("click", () => {
        settingsMenu.classList.remove("settings-menu-visible");
      });
    }
    if (particleCountSlider && particleCountValueDisplay) {
      particleCountSlider.addEventListener("input", (event) => {
        particleCountValueDisplay.textContent = event.target.value;
        refreshParticles();
      });
      particleCountValueDisplay.textContent = particleCountSlider.value;
    }
    if (gradientSpeedSlider && gradientSpeedValueDisplay) {
      gradientSpeedSlider.addEventListener("input", (event) => {
        const speedFactor = parseInt(event.target.value, 10);
        gradientSpeedValueDisplay.textContent = speedFactor;
        gradientAnimationSpeed = 0.0005 * speedFactor;
        const newDuration = Math.max(5, 60 / speedFactor);
        document.documentElement.style.setProperty(
          "--gradient-animation-duration",
          `${newDuration}s`
        );
      });
      gradientSpeedValueDisplay.textContent = gradientSpeedSlider.value;
      const initialSpeedFactor = parseInt(gradientSpeedSlider.value, 10);
      gradientAnimationSpeed = 0.0005 * initialSpeedFactor;
      const initialDuration = Math.max(5, 60 / initialSpeedFactor);
      document.documentElement.style.setProperty(
        "--gradient-animation-duration",
        `${initialDuration}s`
      );
    }
    if (particleSpeedSlider && particleSpeedValueDisplay) {
      particleSpeedSlider.addEventListener("input", (event) => {
        particleSpeedValueDisplay.textContent = parseFloat(
          event.target.value
        ).toFixed(1);
        refreshParticles();
      });
      particleSpeedValueDisplay.textContent = parseFloat(
        particleSpeedSlider.value
      ).toFixed(1);
    }
    if (connectToMouseCheckbox) {
      connectToMouseCheckbox.addEventListener("change", refreshParticles);
    }
    if (repulseMouseCheckbox) {
      repulseMouseCheckbox.addEventListener("change", refreshParticles);
    }
  }

  // --- Family Tree Logic ---
  async function loadFamilyData() {
    console.log("--- loadFamilyData called ---");
    try {
      const response = await fetch("js/familyData.json");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      familyData = await response.json();
      if (familyData.length === 0) {
        console.error("ERROR: familyData is empty!");
        return;
      }
      familyData.forEach((member) => {
        membersMap.set(member.id, member);
        Object.assign(member, {
          x: 0,
          y: 0,
          width: 0,
          drawn: false,
          calculatedWidth: false,
        });
      });
      renderTree();
      setupPanZoom();
      focusOnMe();
    } catch (error) {
      console.error("Load/process error:", error);
    }
  }

  function renderTree() {
    if (!svgElement) {
      return;
    }
    svgElement.innerHTML = "";
    membersMap.forEach((member) => {
      Object.assign(member, {
        drawn: false,
        calculatedWidth: false,
        x: 0,
        y: 0,
        width: 0,
      });
    });
    const allPotentialRoots = familyData.filter(
      (m) => !m.fatherId && !m.motherId
    );
    let overallOffsetX = 50;
    const initialY = NODE_RADIUS + NAME_OFFSET_Y + 30;
    familyData.forEach((member) => {
      if (!member.calculatedWidth) {
        calculateSubtreeWidth(member.id);
      }
    });
    let drawnRootsSet = new Set();
    allPotentialRoots.forEach((rootCandidate) => {
      const rootMember = membersMap.get(rootCandidate.id);
      if (
        !rootMember ||
        rootMember.drawn ||
        drawnRootsSet.has(rootCandidate.id)
      ) {
        return;
      }
      drawnRootsSet.add(rootCandidate.id);
      if (rootMember.partnerId && membersMap.has(rootMember.partnerId)) {
        if (allPotentialRoots.find((pr) => pr.id === rootMember.partnerId)) {
          drawnRootsSet.add(rootMember.partnerId);
        }
      }
      const rootSubtreeWidth = rootMember.width || NODE_RADIUS * 2;
      const rootDrawX = overallOffsetX + rootSubtreeWidth / 2;
      drawMemberAndDescendants(rootMember.id, rootDrawX, initialY, 0);
      overallOffsetX += rootSubtreeWidth + HORIZONTAL_SPACING_SIBLINGS * 1.5;
    });
  }
  function calculateSubtreeWidth(memberId) {
    const member = membersMap.get(memberId);
    if (!member || member.calculatedWidth) return member ? member.width : 0;
    let coupleUnitWidth = NODE_RADIUS * 2;
    if (member.partnerId) {
      coupleUnitWidth = HORIZONTAL_SPACING_PARTNERS + NODE_RADIUS * 2;
    }
    let childrenBlockWidth = 0;
    const partner = member.partnerId ? membersMap.get(member.partnerId) : null;
    if (
      member.childrenIds &&
      member.childrenIds.length > 0 &&
      (!partner || member.id < partner.id || !membersMap.has(member.partnerId))
    ) {
      member.childrenIds.forEach((childId, index) => {
        childrenBlockWidth += calculateSubtreeWidth(childId);
        if (index < member.childrenIds.length - 1) {
          childrenBlockWidth += HORIZONTAL_SPACING_SIBLINGS;
        }
      });
    }
    member.width = Math.max(coupleUnitWidth, childrenBlockWidth);
    member.calculatedWidth = true;
    return member.width;
  }
  function drawMemberAndDescendants(memberId, x, y, level) {
    const member = membersMap.get(memberId);
    if (!member || member.drawn) {
      return;
    }
    member.x = x;
    member.y = y;
    drawNode(member);
    member.drawn = true;
    let coupleMidX = x;
    if (member.partnerId) {
      const partner = membersMap.get(member.partnerId);
      if (partner && !partner.drawn) {
        partner.x = x + HORIZONTAL_SPACING_PARTNERS;
        partner.y = y;
        drawNode(partner);
        partner.drawn = true;
        const line = createSVGElement("line", {
          x1: member.x + NODE_RADIUS + SPOUSE_LINE_MARGIN,
          y1: member.y,
          x2: partner.x - NODE_RADIUS - SPOUSE_LINE_MARGIN,
          y2: partner.y,
          class: "connection-line spouse-line",
        });
        svgElement.appendChild(line);
        coupleMidX = (member.x + partner.x) / 2;
      } else if (partner && partner.drawn) {
        coupleMidX = (member.x + partner.x) / 2;
      }
    }
    const partnerForChildrenCheck = member.partnerId
      ? membersMap.get(member.partnerId)
      : null;
    if (
      member.childrenIds &&
      member.childrenIds.length > 0 &&
      (!partnerForChildrenCheck ||
        member.id < partnerForChildrenCheck.id ||
        !membersMap.has(member.partnerId))
    ) {
      const childrenToDraw = member.childrenIds
        .map((id) => membersMap.get(id))
        .filter((c) => c);
      if (childrenToDraw.length > 0) {
        const childrenY = y + VERTICAL_SPACING_GENERATIONS;
        let requiredChildrenBlockWidth = 0;
        childrenToDraw.forEach((child, i) => {
          requiredChildrenBlockWidth +=
            membersMap.get(child.id)?.width || NODE_RADIUS * 2;
          if (i < childrenToDraw.length - 1) {
            requiredChildrenBlockWidth += HORIZONTAL_SPACING_SIBLINGS;
          }
        });
        let currentChildBlockOriginX =
          coupleMidX - requiredChildrenBlockWidth / 2;
        const parentToChildrenLineY1 =
          member.y + (member.partnerId ? 0 : NODE_RADIUS);
        const childrenHorizontalLineY =
          parentToChildrenLineY1 + CHILD_H_LINE_Y_OFFSET;
        const parentToChildrenLine = createSVGElement("line", {
          x1: coupleMidX,
          y1: parentToChildrenLineY1,
          x2: coupleMidX,
          y2: childrenHorizontalLineY,
          class: "connection-line",
        });
        svgElement.appendChild(parentToChildrenLine);
        if (childrenToDraw.length > 1) {
          const firstChildMember = membersMap.get(childrenToDraw[0].id);
          const lastChildMember = membersMap.get(
            childrenToDraw[childrenToDraw.length - 1].id
          );
          const firstChildDrawX =
            currentChildBlockOriginX +
            (firstChildMember?.width || NODE_RADIUS * 2) / 2;
          const lastChildDrawX =
            coupleMidX +
            requiredChildrenBlockWidth / 2 -
            (lastChildMember?.width || NODE_RADIUS * 2) / 2;
          const childrenHLine = createSVGElement("line", {
            x1: firstChildDrawX,
            y1: childrenHorizontalLineY,
            x2: lastChildDrawX,
            y2: childrenHorizontalLineY,
            class: "connection-line",
          });
          svgElement.appendChild(childrenHLine);
        }
        childrenToDraw.forEach((child) => {
          if (!child) return;
          const childMember = membersMap.get(child.id);
          const childEffectiveWidth = childMember?.width || NODE_RADIUS * 2;
          const childActualDrawX =
            currentChildBlockOriginX + childEffectiveWidth / 2;
          const childVerticalLine = createSVGElement("line", {
            x1: childActualDrawX,
            y1: childrenHorizontalLineY,
            x2: childActualDrawX,
            y2: childrenY - NODE_RADIUS,
            class: "connection-line",
          });
          svgElement.appendChild(childVerticalLine);
          drawMemberAndDescendants(
            child.id,
            childActualDrawX,
            childrenY,
            level + 1
          );
          currentChildBlockOriginX +=
            childEffectiveWidth + HORIZONTAL_SPACING_SIBLINGS;
        });
      }
    }
  }
  function drawNode(member) {
    if (!member || member.x === undefined || member.y === undefined) {
      return;
    }
    const group = createSVGElement("g", {
      class: "node-group",
      transform: `translate(${member.x}, ${member.y})`,
      "data-id": member.id,
    });
    const circle = createSVGElement("circle", {
      cx: 0,
      cy: 0,
      r: NODE_RADIUS,
      class: `node-circle ${member.gender || "other"}`,
    });
    const nameText = createSVGElement("text", {
      x: 0,
      y: NODE_RADIUS + NAME_OFFSET_Y,
      class: "node-name",
    });
    nameText.textContent = member.name;
    group.appendChild(circle);
    group.appendChild(nameText);
    if (svgElement) {
      svgElement.appendChild(group);
    }
    group.addEventListener("click", () => showSidebar(member.id));
  }
  function createSVGElement(tag, attributes) {
    const el = document.createElementNS(svgNS, tag);
    for (const attr in attributes) {
      el.setAttribute(attr, attributes[attr]);
    }
    return el;
  }
  function showSidebar(memberId) {
    const member = membersMap.get(memberId);
    if (!member) {
      return;
    }
    document.getElementById("sidebar-name").textContent = member.name;
    document.getElementById("sb-birthday").textContent =
      member.birthDate || "N/A";
    document.getElementById("sb-gender").textContent = member.gender
      ? member.gender.charAt(0).toUpperCase() + member.gender.slice(1)
      : "N/A";
    const deathDateEl = document.getElementById("sb-deathdate");
    deathDateEl.textContent = member.deathDate || "N/A";
    deathDateEl.closest("p").style.display = member.deathDate
      ? "block"
      : "none";
    document.getElementById("sb-father").textContent = member.fatherId
      ? membersMap.get(member.fatherId)?.name || "N/A"
      : "N/A";
    document.getElementById("sb-mother").textContent = member.motherId
      ? membersMap.get(member.motherId)?.name || "N/A"
      : "N/A";
    let marriedText = "No";
    if (member.partnerId) {
      const partner = membersMap.get(member.partnerId);
      marriedText = partner
        ? `Yes, to ${partner.name}`
        : "Yes (partner data missing)";
    }
    document.getElementById("sb-married").textContent = marriedText;
    const marriageDateEl = document.getElementById("sb-marriagedate");
    marriageDateEl.textContent = member.marriageDate || "N/A";
    marriageDateEl.closest("p").style.display = member.marriageDate
      ? "block"
      : "none";
    document.getElementById("sb-education").textContent =
      member.highestEducationalAttainment || "N/A";
    const courseEl = document.getElementById("sb-course");
    courseEl.textContent = member.collegeCourse || "N/A";
    courseEl.closest("p").style.display = member.collegeCourse
      ? "block"
      : "none";
    document.getElementById("sb-occupation").textContent =
      member.occupation || "N/A";
    document.getElementById("sb-urban").textContent =
      member.grewUpInUrban === null || member.grewUpInUrban === undefined
        ? "N/A"
        : member.grewUpInUrban
        ? "Yes"
        : "No";
    const plansToMoveEl = document.getElementById("sb-moveplans");
    plansToMoveEl.textContent =
      member.plansToMoveOut === null || member.plansToMoveOut === undefined
        ? "N/A"
        : member.plansToMoveOut
        ? "Yes"
        : "No";
    const moveReasonEl = document.getElementById("sb-movereason");
    moveReasonEl.textContent = member.plansToMoveOutReason || "N/A";
    moveReasonEl.closest("p").style.display =
      member.plansToMoveOut && member.plansToMoveOutReason ? "block" : "none";
    if (sidebar) sidebar.classList.add("open");
  }

  // --- Event Listeners for UI (Sidebar, Settings, Drag Detection) ---
  if (closeSidebarButton && sidebar) {
    closeSidebarButton.addEventListener("click", () => {
      sidebar.classList.remove("open");
    });
  } else {
    console.warn("closeSidebarButton or sidebar not found for listener setup.");
  }

  document.addEventListener("click", (event) => {
    if (panOccurredSinceMousedown) {
      // Check this flag first
      // panOccurredSinceMousedown is reset by mousedown on SVG or after this click is processed
      // console.log("Click consumed by pan.");
      return;
    }
    if (
      sidebar &&
      sidebar.classList.contains("open") &&
      !sidebar.contains(event.target) &&
      !event.target.closest(".node-group") &&
      (!settingsIcon || !settingsIcon.contains(event.target)) &&
      (!settingsMenu || !settingsMenu.contains(event.target))
    ) {
      sidebar.classList.remove("open");
    }
    if (
      settingsMenu &&
      settingsMenu.classList.contains("settings-menu-visible") &&
      !settingsMenu.contains(event.target) &&
      (!settingsIcon ||
        (event.target !== settingsIcon && !settingsIcon.contains(event.target)))
    ) {
      settingsMenu.classList.remove("settings-menu-visible");
    }
  });

  if (svgElement) {
    svgElement.addEventListener("mousedown", (e) => {
      if (
        panZoomInstance &&
        panZoomInstance.isPanEnabled() &&
        (e.target === svgElement || e.target.closest(".svg-pan-zoom_viewport"))
      ) {
        isUserPotentiallyPanning = true;
        panOccurredSinceMousedown = false; // Reset on new mousedown
      }
    });
    svgElement.addEventListener(
      "touchstart",
      (e) => {
        if (
          panZoomInstance &&
          panZoomInstance.isPanEnabled() &&
          (e.target === svgElement ||
            e.target.closest(".svg-pan-zoom_viewport"))
        ) {
          isUserPotentiallyPanning = true;
          panOccurredSinceMousedown = false;
        }
      },
      { passive: true }
    );

    // If mouseup happens on SVG, reset potential panning state if no pan actually occurred
    svgElement.addEventListener("mouseup", () => {
      if (isUserPotentiallyPanning && !panOccurredSinceMousedown) {
        // Mousedown was on SVG, but no pan event from svg-pan-zoom fired
        // This means it was likely a click on the SVG background
      }
      isUserPotentiallyPanning = false;
      // panOccurredSinceMousedown is reset by the global click listener OR next mousedown
      // Add a slight delay to reset panOccurredSinceMousedown to handle the click event first
      setTimeout(() => {
        panOccurredSinceMousedown = false;
      }, 0);
    });
    svgElement.addEventListener("touchend", () => {
      isUserPotentiallyPanning = false;
      setTimeout(() => {
        panOccurredSinceMousedown = false;
      }, 0);
    });
  }

  function setupPanZoom() {
    console.log("--- setupPanZoom called (WITH initial fit/center) ---");
    if (typeof svgPanZoom === "undefined") {
      console.error("svgPanZoom undefined!");
      return;
    }
    if (!svgElement) {
      console.error("svgElement null!");
      return;
    }
    try {
      panZoomInstance = svgPanZoom(svgElement, {
        zoomEnabled: true,
        panEnabled: true,
        controlIconsEnabled: false,
        dblClickZoomEnabled: true,
        mouseWheelZoomEnabled: true,
        preventMouseEventsDefault: true,
        zoomScaleSensitivity: 0.2,
        minZoom: 0.1,
        maxZoom: 10,
        fit: true,
        center: true,
        beforePan: function () {
          // Fired when pan operation starts
          if (isUserPotentiallyPanning) {
            panOccurredSinceMousedown = true;
            // console.log("beforePan: panOccurredSinceMousedown = true");
          }
        },
        onPan: function (newPan, oldPanVal) {
          // Also confirms pan
          if (isUserPotentiallyPanning) {
            panOccurredSinceMousedown = true;
          }
          // ... (optional particle reaction logic) ...
        },
        onZoom: function (newZoom) {
          /* ... (optional particle reaction logic) ... */
        },
      });
      console.log("svgPanZoom initialized (WITH initial fit/center).");
      setTimeout(() => {
        const initialMatrix = svgElement
          .querySelector(".svg-pan-zoom_viewport")
          ?.getAttribute("transform");
        console.log(
          "Initial viewport matrix (after setupPanZoom + 100ms):",
          initialMatrix
        );
      }, 100);
    } catch (e) {
      console.error("Error initializing svgPanZoom:", e);
    }
  }

  function focusOnMe() {
    console.log(
      "--- focusOnMe called (Instant - Revised with containerRect) ---"
    );
    if (!panZoomInstance) {
      console.warn("PanZoom instance N/A.");
      return;
    }
    const meNode = membersMap.get("me");
    if (meNode && meNode.x !== undefined && meNode.y !== undefined) {
      console.log(
        `Focusing on 'me': ${meNode.name} at x:${meNode.x}, y:${meNode.y}`
      );
      panZoomInstance.resize();
      console.log(
        `   Attempting zoomAtPoint(${TARGET_ZOOM_LEVEL}, {x: ${meNode.x}, y: ${meNode.y}})`
      );
      panZoomInstance.zoomAtPoint(TARGET_ZOOM_LEVEL, {
        x: meNode.x,
        y: meNode.y,
      });
      const currentPan = panZoomInstance.getPan();
      const currentZoom = panZoomInstance.getZoom();
      const containerRect = svgElement.parentElement.getBoundingClientRect();
      const screenCenterX = containerRect.width / 2;
      const screenCenterY = containerRect.height / 2;
      const meNodeScreenX = meNode.x * currentZoom + currentPan.x;
      const meNodeScreenY = meNode.y * currentZoom + currentPan.y;
      console.log(
        `   After zoomAtPoint (immediate): 'me' screen pos: (${meNodeScreenX.toFixed(
          1
        )}, ${meNodeScreenY.toFixed(
          1
        )}). Target screen center: (${screenCenterX.toFixed(
          1
        )}, ${screenCenterY.toFixed(1)})`
      );
      console.log(
        `   After zoomAtPoint (immediate): pan: {x:${currentPan.x.toFixed(
          1
        )}, y:${currentPan.y.toFixed(1)}}, zoom: ${currentZoom.toFixed(2)}`
      );
      const dx = screenCenterX - meNodeScreenX;
      const dy = screenCenterY - meNodeScreenY;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        console.log(
          `   Applying panBy correction (immediate): dx=${dx.toFixed(
            1
          )}, dy=${dy.toFixed(1)}`
        );
        panZoomInstance.panBy({ x: dx, y: dy });
      } else {
        console.log(
          "   'me' node is already centered enough. No pan correction needed."
        );
      }
      setTimeout(() => {
        const finalMatrix = svgElement
          .querySelector(".svg-pan-zoom_viewport")
          ?.getAttribute("transform");
        const finalPan = panZoomInstance.getPan();
        const finalZoom = panZoomInstance.getZoom();
        console.log(
          "Final Matrix (after INSTANT focusOnMe logic + 50ms log delay):",
          finalMatrix
        );
        console.log(
          `FINAL Pan: {x:${finalPan.x.toFixed(1)}, y:${finalPan.y.toFixed(
            1
          )}}, Zoom: ${finalZoom.toFixed(2)}`
        );
      }, 50);
    } else if (meNode) {
      console.warn("'me' node pos not set. Fallback.");
      panZoomInstance.fit();
      panZoomInstance.center();
    } else {
      console.warn("'me' node not found. Fallback.");
      panZoomInstance.fit();
      panZoomInstance.center();
    }
  }

  // --- Main Execution Order ---
  if (typeof svgPanZoom === "undefined") {
    console.error("svgPanZoom NOT LOADED!");
  }
  if (typeof tsParticles === "undefined") {
    console.error("tsParticles NOT LOADED!");
  }

  if (gradientSpeedSlider) {
    requestAnimationFrame(updateGradientColors);
  } else {
    console.warn(
      "Gradient speed slider not found, gradient animation might not use dynamic speed correctly or start."
    );
  }

  await refreshParticles();
  setupSettingsMenuEventListeners();
  await loadFamilyData();
});

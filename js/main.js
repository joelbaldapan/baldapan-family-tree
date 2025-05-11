// js/main.js
console.log("--- main.js script started ---");

// Wait for the entire HTML document to be fully loaded and parsed.
document.addEventListener("DOMContentLoaded", async () => {
  console.log("--- DOMContentLoaded event fired ---");

  // --- DOM Element Cache ---
  // Store frequently accessed DOM elements to avoid repeated lookups.
  const svgNS = "http://www.w3.org/2000/svg"; // SVG namespace URI
  const svgElement = document.getElementById("family-tree-svg"); // The main SVG container for the family tree
  const sidebar = document.getElementById("sidebar"); // The sidebar element for displaying member details
  const closeSidebarButton = document.getElementById("close-sidebar"); // Button to close the sidebar

  const settingsIcon = document.getElementById("settings-icon"); // Icon to open the settings menu
  const settingsMenu = document.getElementById("settings-menu"); // The settings menu itself
  const closeSettingsMenuButton = document.getElementById(
    "close-settings-menu"
  ); // Button to close the settings menu

  // Settings menu controls
  const particleCountSlider = document.getElementById("particle-count-slider"); // Slider for particle count
  const particleCountValueDisplay = document.getElementById(
    "particle-count-value"
  ); // Displays current particle count
  const gradientSpeedSlider = document.getElementById("gradient-speed-slider"); // Slider for background gradient animation speed
  const gradientSpeedValueDisplay = document.getElementById(
    "gradient-speed-value"
  ); // Displays current gradient speed
  const particleSpeedSlider = document.getElementById("particle-speed-slider"); // Slider for particle movement speed
  const particleSpeedValueDisplay = document.getElementById(
    "particle-speed-value"
  ); // Displays current particle speed
  const connectToMouseCheckbox = document.getElementById(
    "connect-to-mouse-checkbox"
  ); // Checkbox to enable/disable particle connection to mouse
  const repulseMouseCheckbox = document.getElementById(
    "repulse-mouse-checkbox"
  ); // Checkbox to enable/disable particle repulsion from mouse

  // --- Configuration Constants ---
  // Define fixed values used for drawing and layout.
  const NODE_RADIUS = 30; // Radius of the circle representing a family member
  const NAME_OFFSET_Y = 15; // Vertical offset for the name text below the circle
  const HORIZONTAL_SPACING_PARTNERS = NODE_RADIUS * 2 + 60; // Horizontal space between partners
  const HORIZONTAL_SPACING_SIBLINGS = NODE_RADIUS * 2 + 30; // Horizontal space between sibling nodes/subtrees
  const VERTICAL_SPACING_GENERATIONS = NODE_RADIUS * 2 + 80; // Vertical space between generations
  const SPOUSE_LINE_MARGIN = 5; // Small margin for the spouse connection line from the node edge
  const CHILD_H_LINE_Y_OFFSET = 75; // Vertical offset from parent to the horizontal line connecting children
  const TARGET_ZOOM_LEVEL = 2; // Desired zoom level when focusing on "me"
  const SVG_WIDTH = 3000; // Initial width of the SVG canvas
  const SVG_HEIGHT = 2000; // Initial height of the SVG canvas

  // --- State Variables ---
  // Variables that hold the current state of the application.
  let familyData = []; // Array to store the raw family data loaded from JSON
  let membersMap = new Map(); // Map to store family members by their ID for quick lookup
  let panZoomInstance; // Instance of the svg-pan-zoom library
  let tsParticlesInstance; // Instance of the tsParticles library
  let gradientAnimationSpeed =
    0.0005 * // Base speed for gradient animation
    (gradientSpeedSlider ? parseInt(gradientSpeedSlider.value, 10) : 5); // Adjusted by slider value, default if slider not found

  let isUserPotentiallyPanning = false; // Flag: True on mousedown/touchstart on SVG, indicating a pan *might* start
  let panOccurredSinceMousedown = false; // Flag: True if an actual pan event fired after `isUserPotentiallyPanning` was set

  // --- Initial Setup ---
  // Configure the SVG element on load.
  if (svgElement) {
    svgElement.setAttribute("width", SVG_WIDTH);
    svgElement.setAttribute("height", SVG_HEIGHT);
    // Set the viewBox to define the coordinate system and aspect ratio
    svgElement.setAttribute("viewBox", `0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`);
  }

  // --- Gradient Animation ---
  // Defines the colors for the animated background gradient.
  const gradientColors = [
    { r: 10, g: 25, b: 47 },
    { r: 17, g: 34, b: 64 },
    { r: 23, g: 42, b: 69 },
    { r: 10, g: 45, b: 67 },
  ];
  let currentGradientSet = [0, 1, 2]; // Indices of the current three colors in gradientColors array
  let gradientTransitionProgress = 0; // Progress (0 to 1) of transition between gradient sets

  // Function to update the background gradient colors smoothly.
  function updateGradientColors() {
    gradientTransitionProgress += gradientAnimationSpeed; // Increment progress
    // If transition is complete, reset progress and shift to the next set of colors
    if (gradientTransitionProgress >= 1) {
      gradientTransitionProgress = 0;
      currentGradientSet = [
        currentGradientSet[1],
        currentGradientSet[2],
        (currentGradientSet[2] + 1) % gradientColors.length, // Cycle through colors
      ];
    }
    // Get the base colors for the current transition
    const [c1_base, c2_base, c3_base] = currentGradientSet.map(
      (i) => gradientColors[i]
    );
    // Get the target colors for the current transition
    const [c1_target, c2_target, c3_target] = [
      currentGradientSet[1],
      currentGradientSet[2],
      (currentGradientSet[2] + 1) % gradientColors.length,
    ].map((i) => gradientColors[i]);

    // Linear interpolation function
    const lerp = (start, end, t) => Math.round(start + (end - start) * t);

    // Update CSS custom properties with interpolated RGB values for the gradient
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
    // Request the next frame for smooth animation
    requestAnimationFrame(updateGradientColors);
  }

  // --- Particle Configuration & Initialization ---
  // Function to get the current particle options based on settings.
  function getParticleOptions() {
    // Read values from settings sliders/checkboxes, with defaults if elements are missing
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
    let hoverMode = []; // Array to store hover interaction modes
    if (connectToMouse) hoverMode.push("grab");
    if (repulseMouse) hoverMode.push("repulse");

    // Return the tsParticles configuration object
    return {
      fpsLimit: 60, // Limit frames per second for performance
      interactivity: {
        events: {
          onHover: { enable: connectToMouse || repulseMouse, mode: hoverMode }, // Enable hover interactions
          onClick: { enable: false }, // BUG FIX: Particles don't spawn on click (original comment) - onClick disabled
          resize: true, // Particles react to window resize
        },
        modes: {
          grab: { distance: 180, links: { opacity: 0.8, color: "#64ffda" } }, // Grab mode settings
          repulse: {
            // Repulse mode settings
            distance: 100,
            duration: 0.4,
            speed: 1,
            easing: "ease-out-quad",
          },
          push: { quantity: 3 }, // Push mode (not actively used by onClick here)
          bubble: { distance: 200, size: 20, duration: 0.4 }, // Bubble mode (not actively used)
        },
      },
      particles: {
        color: { value: "#64ffda" }, // Particle color
        links: {
          // Particle links settings
          color: "#64ffda",
          distance: 150,
          enable: true,
          opacity: 0.12,
          width: 1,
        },
        collisions: { enable: false }, // Disable particle collisions
        move: {
          // Particle movement settings
          direction: "none",
          enable: true,
          outModes: { default: "bounce" }, // Bounce off canvas edges
          random: true,
          speed: speed, // Speed from slider
          straight: false,
        },
        number: {
          // Particle number settings
          density: { enable: true, area: 800 },
          value: count, // Count from slider
        },
        opacity: {
          // Particle opacity settings
          value: { min: 0.1, max: 0.4 },
          animation: { enable: true, speed: 0.8, minimumValue: 0.05 },
        },
        shape: { type: "circle" }, // Particle shape
        size: {
          // Particle size settings
          value: { min: 0.5, max: 2.5 },
          animation: { enable: true, speed: 2.5, minimumValue: 0.2 },
        },
      },
      detectRetina: true, // Enable retina display support
      background: { color: "transparent" }, // Transparent background for particles canvas
    };
  }

  // Function to refresh (destroy and reload) the particle animation.
  async function refreshParticles() {
    if (window.tsParticles) {
      // Check if tsParticles library is loaded
      // Destroy existing instance if it exists
      if (
        tsParticlesInstance &&
        typeof tsParticlesInstance.destroy === "function"
      ) {
        tsParticlesInstance.destroy();
      } else if (
        window.tsParticles.dom &&
        window.tsParticles.dom().length > 0
      ) {
        // Fallback for older tsParticles or different initialization
        window.tsParticles.domItem(0)?.destroy();
      }
      try {
        const options = getParticleOptions(); // Get current particle options
        // Load new tsParticles instance with the options
        tsParticlesInstance = await tsParticles.load(
          "particles-container", // ID of the container element for particles
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
  // Function to set up event listeners for the settings menu controls.
  function setupSettingsMenuEventListeners() {
    // Check if all required UI elements are present
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
      // No return here, so it will try to attach listeners to existing elements.
    }

    // Toggle settings menu visibility on icon click
    if (settingsIcon && settingsMenu) {
      settingsIcon.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent click from bubbling up to document listener
        settingsMenu.classList.toggle("settings-menu-visible");
      });
    }
    // Close settings menu on close button click
    if (closeSettingsMenuButton && settingsMenu) {
      closeSettingsMenuButton.addEventListener("click", () => {
        settingsMenu.classList.remove("settings-menu-visible");
      });
    }
    // Particle count slider: update display and refresh particles on input
    if (particleCountSlider && particleCountValueDisplay) {
      particleCountSlider.addEventListener("input", (event) => {
        particleCountValueDisplay.textContent = event.target.value;
        refreshParticles();
      });
      particleCountValueDisplay.textContent = particleCountSlider.value; // Initialize display
    }
    // Gradient speed slider: update display, animation speed, and CSS variable on input
    if (gradientSpeedSlider && gradientSpeedValueDisplay) {
      gradientSpeedSlider.addEventListener("input", (event) => {
        const speedFactor = parseInt(event.target.value, 10);
        gradientSpeedValueDisplay.textContent = speedFactor;
        gradientAnimationSpeed = 0.0005 * speedFactor; // Update JS animation speed
        // Update CSS animation duration (if CSS animations are also used for gradient)
        const newDuration = Math.max(5, 60 / speedFactor); // Ensure a minimum duration
        document.documentElement.style.setProperty(
          "--gradient-animation-duration",
          `${newDuration}s`
        );
      });
      // Initialize display and speed from slider's initial value
      gradientSpeedValueDisplay.textContent = gradientSpeedSlider.value;
      const initialSpeedFactor = parseInt(gradientSpeedSlider.value, 10);
      gradientAnimationSpeed = 0.0005 * initialSpeedFactor;
      const initialDuration = Math.max(5, 60 / initialSpeedFactor);
      document.documentElement.style.setProperty(
        "--gradient-animation-duration",
        `${initialDuration}s`
      );
    }
    // Particle speed slider: update display and refresh particles on input
    if (particleSpeedSlider && particleSpeedValueDisplay) {
      particleSpeedSlider.addEventListener("input", (event) => {
        particleSpeedValueDisplay.textContent = parseFloat(
          event.target.value
        ).toFixed(1);
        refreshParticles();
      });
      particleSpeedValueDisplay.textContent = parseFloat(
        particleSpeedSlider.value
      ).toFixed(1); // Initialize display
    }
    // Connect to mouse checkbox: refresh particles on change
    if (connectToMouseCheckbox) {
      connectToMouseCheckbox.addEventListener("change", refreshParticles);
    }
    // Repulse mouse checkbox: refresh particles on change
    if (repulseMouseCheckbox) {
      repulseMouseCheckbox.addEventListener("change", refreshParticles);
    }
  }

  // --- Family Tree Logic ---
  // Helper function to calculate age
  function calculateAge(birthDate, deathDate) {
    if (!birthDate) return "N/A";
    try {
      const startDate = new Date(birthDate);
      // If deathDate is provided, use it as the end date; otherwise, use the current date.
      const endDate = deathDate ? new Date(deathDate) : new Date();

      if (isNaN(startDate.getTime())) return "N/A"; // Invalid birth date format
      // If deathDate was provided but is invalid, treat as if not provided for age calculation up to today.
      const effectiveEndDate =
        deathDate && isNaN(endDate.getTime()) ? new Date() : endDate;

      let age = effectiveEndDate.getFullYear() - startDate.getFullYear();
      const monthDifference =
        effectiveEndDate.getMonth() - startDate.getMonth();
      if (
        monthDifference < 0 ||
        (monthDifference === 0 &&
          effectiveEndDate.getDate() < startDate.getDate())
      ) {
        age--;
      }
      return age >= 0 ? age.toString() : "N/A"; // Return age as string or N/A
    } catch (e) {
      console.error("Error calculating age:", e);
      return "N/A";
    }
  }
  // Asynchronously loads family data from a JSON file.
  async function loadFamilyData() {
    console.log("--- loadFamilyData called ---");
    try {
      const response = await fetch("js/familyData.json"); // Fetch the data
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      familyData = await response.json(); // Parse JSON response
      if (familyData.length === 0) {
        console.error("ERROR: familyData is empty!");
        return;
      }
      // Process each member: add to map and initialize properties
      familyData.forEach((member) => {
        membersMap.set(member.id, member);
        // Initialize properties for layout and drawing
        Object.assign(member, {
          x: 0, // X-coordinate (center of node)
          y: 0, // Y-coordinate (center of node)
          width: 0, // Width of the subtree rooted at this member
          drawn: false, // Flag to prevent redrawing
          calculatedWidth: false, // Flag to prevent recalculating width
        });
      });
      renderTree(); // Render the tree structure
      setupPanZoom(); // Initialize pan and zoom functionality
      focusOnMe(); // Focus on the "me" member if specified
    } catch (error) {
      console.error("Load/process error:", error);
    }
  }

  // Renders the entire family tree in the SVG element.
  // Renders the entire family tree in the SVG element.
  function renderTree() {
    if (!svgElement) {
      console.error("SVG element not found for rendering.");
      return;
    }
    svgElement.innerHTML = "";

    membersMap.forEach((member) => {
      Object.assign(member, {
        drawn: false,
        calculatedWidth: false,
        x: 0,
        y: 0,
      });
    });

    console.log("--- Calculating all subtree widths ---");
    familyData.forEach((memberData) => {
      const member = membersMap.get(memberData.id);
      if (member && !member.calculatedWidth) {
        calculateSubtreeWidth(member.id); // Ensure this uses cycle detection if needed
      }
    });
    console.log("--- Subtree width calculation complete ---");

    let overallOffsetX = 50;
    const initialY = NODE_RADIUS + NAME_OFFSET_Y + 30;

    // This set tracks individuals who have initiated a drawing pass as a root,
    // OR their partner if they were drawn as part of that root unit initiation.
    // This prevents processing a couple twice if both have no parents.
    let processedRootInitiators = new Set();

    console.log(
      "--- PASS 1: Drawing members with no parents (and their partners) ---"
    );
    familyData.forEach((memberData) => {
      const member = membersMap.get(memberData.id);

      if (!member || processedRootInitiators.has(member.id) || member.drawn) {
        // Skip if:
        // - Member not found
        // - Member (or their partner) already initiated a root drawing pass
        // - Member was somehow already drawn (e.g., as a spouse of a previously processed root)
        return;
      }

      // Condition for being an "initial drawing point" (root of a horizontal tree segment)
      if (member.fatherId === null && member.motherId === null) {
        // This member has no parents, so they are a potential root.

        processedRootInitiators.add(member.id);
        const partner = member.partnerId
          ? membersMap.get(member.partnerId)
          : null;
        if (partner) {
          // Also mark the partner as processed for root initiation purposes,
          // to avoid the partner also starting a new tree if they also have no parents.
          processedRootInitiators.add(partner.id);
        }

        const currentUnitSubtreeWidth = member.width || NODE_RADIUS * 2; // member.width should be calculated
        const rootDrawX = overallOffsetX + currentUnitSubtreeWidth / 2;

        console.log(
          `  ROOT: Drawing tree starting with ${member.fullName} (ID: ${member.id}) at x: ${rootDrawX}`
        );
        drawMemberAndDescendants(member.id, rootDrawX, initialY, 0);
        overallOffsetX +=
          currentUnitSubtreeWidth + HORIZONTAL_SPACING_SIBLINGS * 1.5;
      }
    });

    console.log(
      "--- PASS 2: Drawing any remaining (orphaned or disconnected) members ---"
    );
    // This pass is a fallback to ensure everyone gets drawn if they weren't connected
    // to the "no parent" roots.
    familyData.forEach((memberData) => {
      const member = membersMap.get(memberData.id);
      if (member && !member.drawn && !processedRootInitiators.has(member.id)) {
        // This member wasn't drawn and wasn't a primary root initiator (or their partner)

        // To avoid drawing a couple twice in this pass if both are undrawn
        const partner = member.partnerId
          ? membersMap.get(member.partnerId)
          : null;
        if (
          partner &&
          !partner.drawn &&
          processedRootInitiators.has(partner.id)
        ) {
          // If partner was a root initiator but this member wasn't drawn with them (should be rare),
          // let this member draw now.
        } else if (partner && !partner.drawn && member.id > partner.id) {
          // If both are undrawn and not root initiators, let the one with smaller ID handle it.
          return;
        }

        processedRootInitiators.add(member.id); // Mark as "processed for drawing initiation" in this pass
        if (partner) processedRootInitiators.add(partner.id);

        const subtreeWidth = member.width || NODE_RADIUS * 2;
        const rootDrawX = overallOffsetX + subtreeWidth / 2;
        console.log(
          `  PASS 2: Drawing remaining unit starting with: ${member.fullName} (ID: ${member.id}) at x: ${rootDrawX}`
        );
        drawMemberAndDescendants(member.id, rootDrawX, initialY, 0);
        overallOffsetX += subtreeWidth + HORIZONTAL_SPACING_SIBLINGS * 1.5;
      }
    });
    console.log("--- Tree rendering complete ---");
  }

  // Recursively calculates the horizontal width required by a member and their descendants.
  function calculateSubtreeWidth(memberId, path = []) {
    // Infinite recursion guard
    if (path.includes(memberId)) {
      console.error(
        `INFINITE RECURSION DETECTED for ${memberId}! Path: ${path.join(
          " -> "
        )} -> ${memberId}`
      );
      return 0; // Break cycle
    }
    const newPath = [...path, memberId];

    const member = membersMap.get(memberId);

    if (!member) {
      console.warn(
        `calculateSubtreeWidth: Member with ID '${memberId}' not found in membersMap. Path: ${newPath.join(
          " -> "
        )}`
      );
      return 0;
    }
    if (member.calculatedWidth) {
      return member.width;
    }

    // Width for the member's node itself
    let coupleUnitWidth = NODE_RADIUS * 2;
    const partner = member.partnerId ? membersMap.get(member.partnerId) : null;

    // If they have a partner, the couple unit is wider
    if (member.partnerId) {
      // No need to check if partner object exists here, just if ID is present
      coupleUnitWidth =
        NODE_RADIUS * 2 + HORIZONTAL_SPACING_PARTNERS + NODE_RADIUS * 2;
    }

    let childrenBlockWidth = 0;
    let shouldProcessChildrenWidth = false;

    if (member.childrenIds && member.childrenIds.length > 0) {
      if (!partner) {
        // No partner, so this member processes children's width
        shouldProcessChildrenWidth = true;
      } else if (!membersMap.has(member.partnerId)) {
        // Partner ID exists, but partner not in map
        shouldProcessChildrenWidth = true;
      } else if (partner && typeof member.id === typeof partner.id) {
        // Both IDs exist and are same type
        // Determine which parent calculates children's width (e.g., smaller ID)
        shouldProcessChildrenWidth = member.id < partner.id;
      } else {
        // Fallback if IDs are weird, let current member try (or a more robust rule)
        // console.warn(`Ambiguous ID comparison for children width: ${member.id} and partner ${partner ? partner.id : 'N/A'}`);
        shouldProcessChildrenWidth = true;
      }
    }

    if (shouldProcessChildrenWidth) {
      member.childrenIds.forEach((childId, index) => {
        if (!childId) {
          console.error(
            `NULL or UNDEFINED childId found for parent ${
              member.fullName
            } (ID: ${memberId}) at index ${index}. Path: ${newPath.join(
              " -> "
            )}`
          );
          return;
        }
        childrenBlockWidth += calculateSubtreeWidth(childId, newPath); // Recursive call
        if (index < member.childrenIds.length - 1) {
          childrenBlockWidth += HORIZONTAL_SPACING_SIBLINGS;
        }
      });
    }

    member.width = Math.max(coupleUnitWidth, childrenBlockWidth);
    member.calculatedWidth = true;
    // console.log(`Calculated width for ${member.fullName} (ID: ${memberId}): ${member.width}`);
    return member.width;
  }

  // Recursively draws a member, their partner, and their descendants.
  function drawMemberAndDescendants(memberId, x, y, level) {
    const member = membersMap.get(memberId);

    // --- START DEBUG LOGGING ---
    const debugIds = [
      "member_marphelina_ansing_baldapan",
      "member_angel_bagcat_baldapan_sr.",
      "member_joel_ansing_baldapan",
      "member_ma._phoebe_penales_baldapan",
      "member_joel_angelo_penales_baldapan",
      "member_dominador_sulit_penales_jr.",
      "member_rhodora_ebojo_penales",
      // Add any other IDs you are specifically investigating
    ];

    const isDebuggingThisMember = member && debugIds.includes(member.id);

    if (isDebuggingThisMember || (!member && debugIds.includes(memberId))) {
      console.log(
        `--- DMD Processing ${
          member ? member.fullName : memberId
        } (ID: ${memberId}) ---`
      );
      console.log(
        `  Called at x: ${x.toFixed(1)}, y: ${y.toFixed(1)}, level: ${level}`
      );
      if (member) {
        console.log(`  Current drawn status: ${member.drawn}`);
        console.log(
          `  FatherId: ${member.fatherId}, MotherId: ${member.motherId}`
        );
        console.log(`  PartnerId: ${member.partnerId}`);
        console.log(
          `  ChildrenIds: ${
            member.childrenIds && member.childrenIds.length > 0
              ? member.childrenIds.join(", ")
              : "None"
          }`
        );
      } else {
        console.error(`  MEMBER ${memberId} NOT FOUND IN membersMap!`);
      }
    }
    // --- END DEBUG LOGGING ---

    if (!member) {
      return;
    }

    if (member.drawn) {
      if (isDebuggingThisMember) {
        console.log(
          `  ${member.fullName} is ALREADY DRAWN. Returning from DMD.`
        );
      }
      return;
    }

    member.x = x;
    member.y = y;
    drawNode(member);
    member.drawn = true;
    if (isDebuggingThisMember) {
      console.log(`  Node drawn for ${member.fullName}. Set drawn = true.`);
    }

    let coupleMidX = member.x;
    const partner = member.partnerId ? membersMap.get(member.partnerId) : null;
    let partnerWasJustDrawn = false;

    if (partner) {
      if (isDebuggingThisMember || (partner && debugIds.includes(partner.id))) {
        console.log(
          `  Partner for ${member.fullName} is ${partner.fullName} (ID: ${partner.id}). Partner's current drawn status: ${partner.drawn}`
        );
      }

      if (!partner.drawn) {
        if (
          isDebuggingThisMember ||
          (partner && debugIds.includes(partner.id))
        ) {
          console.log(
            `    Partner ${partner.fullName} is NOT drawn. Drawing now next to ${member.fullName}.`
          );
        }
        partner.x = member.x + HORIZONTAL_SPACING_PARTNERS;
        partner.y = member.y;
        drawNode(partner);
        partner.drawn = true;
        partnerWasJustDrawn = true;
        if (partner && debugIds.includes(partner.id)) {
          console.log(
            `    Node drawn for partner ${partner.fullName}. Set partner.drawn = true.`
          );
        }

        const line = createSVGElement("line", {
          x1: member.x + NODE_RADIUS + SPOUSE_LINE_MARGIN,
          y1: member.y,
          x2: partner.x - NODE_RADIUS - SPOUSE_LINE_MARGIN,
          y2: partner.y,
          class: "connection-line spouse-line",
        });
        svgElement.appendChild(line);
        coupleMidX = (member.x + partner.x) / 2;
      } else {
        if (isDebuggingThisMember) {
          console.log(
            `    Partner ${partner.fullName} for ${
              member.fullName
            } IS ALREADY DRAWN (at x:${partner.x.toFixed(
              1
            )}, y:${partner.y.toFixed(1)}).`
          );
        }
        coupleMidX = (member.x + partner.x) / 2;
        if (member.id < partner.id) {
          if (isDebuggingThisMember) {
            console.log(
              `      ${member.fullName} (ID: ${member.id}) < ${partner.fullName} (ID: ${partner.id}). Drawing connecting line to already drawn partner.`
            );
          }
          const line = createSVGElement("line", {
            x1: member.x + NODE_RADIUS + SPOUSE_LINE_MARGIN,
            y1: member.y,
            x2: partner.x - NODE_RADIUS - SPOUSE_LINE_MARGIN,
            y2: partner.y,
            class: "connection-line spouse-line",
          });
          svgElement.appendChild(line);
        } else if (isDebuggingThisMember) {
          console.log(
            `      ${member.fullName} (ID: ${member.id}) NOT < ${partner.fullName} (ID: ${partner.id}). Line should be drawn by partner if they initiated.`
          );
        }
      }
    } else if (isDebuggingThisMember && member.partnerId) {
      console.warn(
        `  Partner with ID '${member.partnerId}' for ${member.fullName} not found in membersMap.`
      );
    }

    let designatedChildDrawer = null;
    let childrenIdsForThisCouple = null;

    if (member.childrenIds && member.childrenIds.length > 0) {
      childrenIdsForThisCouple = member.childrenIds;
    } else if (
      partner &&
      partner.childrenIds &&
      partner.childrenIds.length > 0
    ) {
      childrenIdsForThisCouple = partner.childrenIds;
    }

    if (childrenIdsForThisCouple && childrenIdsForThisCouple.length > 0) {
      if (!partner) {
        designatedChildDrawer = member;
      } else if (!membersMap.has(member.partnerId)) {
        designatedChildDrawer = member;
        if (isDebuggingThisMember)
          console.warn(
            `    Partner ID ${member.partnerId} for ${member.fullName} not found in membersMap for child drawing decision.`
          );
      } else if (partner && typeof member.id === typeof partner.id) {
        if (member.id < partner.id) {
          designatedChildDrawer = member;
        } else {
          designatedChildDrawer = partner;
        }
      } else {
        designatedChildDrawer = member;
        if (isDebuggingThisMember)
          console.warn(
            `    Ambiguous ID comparison for drawing children between ${
              member.fullName
            } and partner ${
              partner ? partner.fullName : "N/A"
            }. Defaulting to ${member.fullName} drawing.`
          );
      }
    }

    let actuallyDrawChildrenNow = false;
    if (designatedChildDrawer) {
      if (designatedChildDrawer === member) {
        actuallyDrawChildrenNow = true;
      } else if (partnerWasJustDrawn && designatedChildDrawer === partner) {
        actuallyDrawChildrenNow = true;
        if (
          isDebuggingThisMember ||
          (partner && debugIds.includes(partner.id))
        ) {
          console.log(
            `    ${member.fullName} drew partner ${partner.fullName}. Partner is designated child drawer. Proceeding to draw children for the couple.`
          );
        }
      }
    }

    if (
      isDebuggingThisMember &&
      childrenIdsForThisCouple &&
      childrenIdsForThisCouple.length > 0
    ) {
      console.log(
        `  For couple involving ${member.fullName}, designated child drawer: ${
          designatedChildDrawer ? designatedChildDrawer.fullName : "None"
        }. This call is for ${
          member.fullName
        }. actuallyDrawChildrenNow: ${actuallyDrawChildrenNow}`
      );
    }

    if (
      actuallyDrawChildrenNow &&
      designatedChildDrawer.childrenIds &&
      designatedChildDrawer.childrenIds.length > 0
    ) {
      const childrenIdsToProcess = designatedChildDrawer.childrenIds;

      if (
        isDebuggingThisMember ||
        (designatedChildDrawer && debugIds.includes(designatedChildDrawer.id))
      ) {
        console.log(
          `    ${
            designatedChildDrawer.fullName
          } IS DRAWING CHILDREN STRUCTURE: ${childrenIdsToProcess.join(", ")}`
        );
      }

      const childrenToDraw = childrenIdsToProcess
        .map((childId) => {
          const childObj = membersMap.get(childId);
          if (
            !childObj &&
            (isDebuggingThisMember ||
              (designatedChildDrawer &&
                debugIds.includes(designatedChildDrawer.id)))
          ) {
            console.error(
              `      Child ID '${childId}' for ${designatedChildDrawer.fullName} NOT FOUND in membersMap!`
            );
          }
          return childObj;
        })
        .filter((c) => c);

      if (
        isDebuggingThisMember ||
        (designatedChildDrawer &&
          debugIds.includes(designatedChildDrawer.id) &&
          childrenToDraw.length > 0)
      ) {
        console.log(
          `      Found ${childrenToDraw.length} valid children objects to draw for ${designatedChildDrawer.fullName}.`
        );
      }

      if (childrenToDraw.length > 0) {
        const childrenNodesY = member.y + VERTICAL_SPACING_GENERATIONS;
        let requiredChildrenBlockWidth = 0;
        childrenToDraw.forEach((child, i) => {
          requiredChildrenBlockWidth += child.width || NODE_RADIUS * 2;
          if (i < childrenToDraw.length - 1) {
            requiredChildrenBlockWidth += HORIZONTAL_SPACING_SIBLINGS;
          }
        });

        let currentChildNodeBlockOriginX =
          coupleMidX - requiredChildrenBlockWidth / 2;
        const parentConnectionY =
          member.y +
          (partner && partner.drawn && Math.abs(partner.y - member.y) < 1
            ? 0
            : NODE_RADIUS);
        const childrenHorizontalLineY =
          parentConnectionY + CHILD_H_LINE_Y_OFFSET;

        if (
          isDebuggingThisMember &&
          designatedChildDrawer &&
          debugIds.includes(designatedChildDrawer.id)
        ) {
          console.log(
            `      Children structure for ${
              designatedChildDrawer.fullName
            }: coupleMidX=${coupleMidX.toFixed(
              1
            )}, childrenNodesY=${childrenNodesY.toFixed(
              1
            )}, childrenHorizontalLineY=${childrenHorizontalLineY.toFixed(
              1
            )}, parentConnectionY=${parentConnectionY.toFixed(1)}`
          );
        }

        const parentToChildrenStem = createSVGElement("line", {
          x1: coupleMidX,
          y1: parentConnectionY,
          x2: coupleMidX,
          y2: childrenHorizontalLineY,
          class: "connection-line parent-stem",
        });
        svgElement.appendChild(parentToChildrenStem);

        if (childrenToDraw.length > 1) {
          let idealFirstChildX =
            currentChildNodeBlockOriginX +
            (childrenToDraw[0].width || NODE_RADIUS * 2) / 2;
          const idealLastChild = childrenToDraw[childrenToDraw.length - 1];
          let idealLastChildX =
            currentChildNodeBlockOriginX +
            requiredChildrenBlockWidth -
            (idealLastChild.width || NODE_RADIUS * 2) / 2;

          const childrenHLine = createSVGElement("line", {
            x1: idealFirstChildX,
            y1: childrenHorizontalLineY,
            x2: idealLastChildX,
            y2: childrenHorizontalLineY,
            class: "connection-line children-hline",
          });
          svgElement.appendChild(childrenHLine);
        }
        childrenToDraw.forEach((child) => {
          const childIdealEffectiveWidth = child.width || NODE_RADIUS * 2;
          // X position where this child *would be placed* if drawn by this parent in this sequence
          const childIdealDrawX =
            currentChildNodeBlockOriginX + childIdealEffectiveWidth / 2;
          // Y position for children nodes (where their center would be if drawn by this parent)
          const childIdealDrawY = childrenNodesY; // childrenNodesY is member.y + VERTICAL_SPACING_GENERATIONS

          if (!child.drawn) {
            // Child is NOT yet drawn, draw standard vertical connector and then the child node.
            const childVerticalConnector = createSVGElement("line", {
              x1: childIdealDrawX,
              y1: childrenHorizontalLineY,
              x2: childIdealDrawX, // Connects straight down
              y2: childIdealDrawY - NODE_RADIUS, // To top of where child node will be
              class: "connection-line child-connector",
            });
            svgElement.appendChild(childVerticalConnector);

            if (
              isDebuggingThisMember ||
              (designatedChildDrawer &&
                debugIds.includes(designatedChildDrawer.id)) ||
              debugIds.includes(child.id)
            ) {
              console.log(
                `        ${
                  designatedChildDrawer.fullName
                } -> Calling DMD for UNDRAWN child: ${child.fullName} (ID: ${
                  child.id
                }) at ideal X:${childIdealDrawX.toFixed(
                  1
                )}, Y:${childIdealDrawY.toFixed(1)}`
              );
            }
            drawMemberAndDescendants(
              child.id,
              childIdealDrawX,
              childIdealDrawY,
              level + 1
            );
          } else {
            // Child IS ALREADY DRAWN elsewhere. Draw an L-shaped connector as per the red line diagram.
            if (
              isDebuggingThisMember ||
              (designatedChildDrawer &&
                debugIds.includes(designatedChildDrawer.id)) ||
              debugIds.includes(child.id)
            ) {
              console.log(
                `        ${designatedChildDrawer.fullName} -> Child ${
                  child.fullName
                } (ID: ${child.id}) is ALREADY DRAWN at x:${child.x.toFixed(
                  1
                )}, y:${child.y.toFixed(
                  1
                )}. Drawing L-shaped (red-line style) connector.`
              );
            }

            // Point P_Parent_Stem_End: Where the main vertical stem from the parent(s) ends and the childrenHorizontalLine begins.
            // This is (coupleMidX, childrenHorizontalLineY)

            // Point P_Elbow: The corner of the "L".
            // It's horizontally aligned with the child's actual X,
            // and vertically at the level of the childrenHorizontalLineY.
            const pElbowX = child.x;
            const pElbowY = childrenHorizontalLineY;

            // Point P_Child_Connect: Top-center of the child's actual node.
            const pChildConnectX = child.x;
            const pChildConnectY = child.y - NODE_RADIUS;

            // Segment 1: Horizontal line from the parent's main stem end (or the ideal position of the first/last child on that bar if multiple children)
            // to the elbow point (P_Elbow).
            // The x1 of this line depends on whether this child is the only child, first, last, or middle.
            // For simplicity, if it's a single child being connected this way, or if we want the bar to extend,
            // we can draw from the parent's stem end (coupleMidX, childrenHorizontalLineY) to (child.x, childrenHorizontalLineY).

            // If there's only one child being drawn by this parent OR if this is the only child needing an L-connector,
            // the horizontal line starts from the parent's main stem.
            // If there are multiple children and this is one of them, the horizontal line starts from its ideal X position.
            // Let's use childIdealDrawX for the connection to the main childrenHorizontalLineY,
            // then draw the L from there. This matches the previous Z-shape's start.

            // Start of L-shape connection (from the parent's children distribution bar at child's ideal X)
            const startLx = childIdealDrawX;
            const startLy = childrenHorizontalLineY;

            // Elbow of the L-shape
            const elbowLx = child.x; // Horizontal line extends to child's actual X
            const elbowLy = startLy; // Stays at the same Y level

            // End of L-shape (top of child's circle)
            const endLx = child.x;
            const endLy = child.y - NODE_RADIUS;

            // Draw the L-shape:
            // Segment 1: Horizontal from ideal position on bar to align with child's actual X
            if (Math.abs(startLx - elbowLx) > 0.5) {
              const lineSegHorizontal = createSVGElement("line", {
                x1: startLx,
                y1: startLy,
                x2: elbowLx,
                y2: elbowLy,
                class: "connection-line child-connector l-shape-horizontal",
              });
              svgElement.appendChild(lineSegHorizontal);
            } else if (isDebuggingThisMember) {
              // If startLx is already child.x, no horizontal line needed from ideal X,
              // just a vertical drop from childrenHorizontalLineY at child.x
              console.log(
                `        L-shape: Child ${child.fullName} is already aligned horizontally with its ideal X. Skipping horizontal segment from ideal X.`
              );
            }

            // Segment 2: Vertical from elbow (now at child's X, childrenHorizontalLineY level) down to child
            if (endLy > elbowLy && Math.abs(elbowLy - endLy) > 0.5) {
              // Ensure it's dropping down
              const lineSegVertical = createSVGElement("line", {
                x1: elbowLx,
                y1: elbowLy,
                x2: endLx,
                y2: endLy,
                class: "connection-line child-connector l-shape-vertical",
              });
              svgElement.appendChild(lineSegVertical);
            } else if (isDebuggingThisMember) {
              console.warn(
                `        L-shape: Child ${child.fullName} is not below the childrenHorizontalLineY or too close. Vertical segment issue. elbowLy: ${elbowLy}, endLy: ${endLy}`
              );
            }
          }
          currentChildNodeBlockOriginX +=
            childIdealEffectiveWidth + HORIZONTAL_SPACING_SIBLINGS;
        });
      }
    } else if (
      childrenIdsForThisCouple &&
      childrenIdsForThisCouple.length > 0 &&
      isDebuggingThisMember
    ) {
      console.log(
        `    ${
          member.fullName
        } is NOT the designated child drawer OR partner wasn't just drawn by this call to trigger child drawing. Designated: ${
          designatedChildDrawer ? designatedChildDrawer.fullName : "None"
        }.`
      );
    }

    if (isDebuggingThisMember) {
      console.log(`--- DMD Finished ${member.fullName} (ID: ${memberId}) ---`);
    }
  }

  // Draws a single family member node (circle and name).
  function drawNode(member) {
    if (!member || member.x === undefined || member.y === undefined) {
      return;
    }
    const group = createSVGElement("g", {
      class: "node-group",
      transform: `translate(${member.x}, ${member.y})`,
      "data-id": member.id,
    });

    // UPDATED: Use member.sex for class, ensure it's lowercase. Fallback to "other".
    const circle = createSVGElement("circle", {
      cx: 0,
      cy: 0,
      r: NODE_RADIUS,
      class: `node-circle ${member.sex ? member.sex.toLowerCase() : "other"}`,
    });

    const nameText = createSVGElement("text", {
      x: 0,
      y: NODE_RADIUS + NAME_OFFSET_Y,
      class: "node-name",
    });
    // UPDATED: Use member.fullName for the text content.
    nameText.textContent = member.fullName || "N/A"; // Use fullName, or "N/A" if not present

    group.appendChild(circle);
    group.appendChild(nameText);
    if (svgElement) {
      svgElement.appendChild(group);
    }
    group.addEventListener("click", () => showSidebar(member.id));
  }

  // Helper function to create an SVG element with specified attributes.
  function createSVGElement(tag, attributes) {
    const el = document.createElementNS(svgNS, tag); // Create element in SVG namespace
    for (const attr in attributes) {
      el.setAttribute(attr, attributes[attr]); // Set all provided attributes
    }
    return el;
  }

  // Displays member details in the sidebar.
  function showSidebar(memberId) {
    const member = membersMap.get(memberId);
    if (!member) {
      return;
    }

    // Helper to safely get text or return "N/A"
    const getText = (value) =>
      value !== null && value !== undefined && value !== ""
        ? String(value)
        : "N/A";
    // Helper for boolean values
    const getBooleanText = (value, yesText = "Yes", noText = "No") => {
      if (value === null || value === undefined) return "N/A";
      return value ? yesText : noText;
    };

    document.getElementById("sidebar-name").textContent = getText(
      member.fullName
    );
    const imageEl = document.getElementById("sb-image");
    if (member.imageLink) {
      imageEl.src = member.imageLink;
      imageEl.alt = getText(member.fullName);
      imageEl.style.display = "inline-block";
    } else {
      imageEl.src = "";
      imageEl.style.display = "none";
    }
    document.getElementById("sb-sex").textContent = getText(member.sex);
    document.getElementById("sb-age").textContent = calculateAge(
      member.birthDate,
      member.deathDate
    ); // Assuming calculateAge is defined
    document.getElementById("sb-birthdate").textContent = getText(
      member.birthDate
    );
    const deathDateEl = document.getElementById("sb-deathdate");
    deathDateEl.textContent = getText(member.deathDate);
    deathDateEl.closest("p").style.display = member.deathDate
      ? "block"
      : "none";

    let fatherDisplay = "N/A";
    if (member.fatherId) {
      const fatherObj = membersMap.get(member.fatherId);
      if (fatherObj) {
        fatherDisplay = getText(fatherObj.fullName);
      } else {
        fatherDisplay = "Unknown (ID not found)"; // Or just "N/A"
      }
    }
    document.getElementById("sb-fathername").textContent = fatherDisplay;

    let motherDisplay = "N/A";
    if (member.motherId) {
      const motherObj = membersMap.get(member.motherId);
      if (motherObj) {
        motherDisplay = getText(motherObj.fullName);
      } else {
        motherDisplay = "Unknown (ID not found)"; // Or just "N/A"
      }
    }
    document.getElementById("sb-mothername").textContent = motherDisplay;

    document.getElementById("sb-married-status").textContent = getBooleanText(
      member.married
    );

    const spouseNameEl = document.getElementById("sb-spousename");
    let spouseDisplay = "N/A";
    if (member.married && member.partnerId) {
      // Check if married and partnerId exists
      const partnerObj = membersMap.get(member.partnerId);
      if (partnerObj) {
        spouseDisplay = getText(partnerObj.fullName);
      } else {
        spouseDisplay = "Unknown (ID not found)"; // Or just "N/A"
      }
    }
    spouseNameEl.textContent = spouseDisplay;
    // Show spouse field only if married and spouse name is available (not "N/A" or "Unknown")
    spouseNameEl.closest("p").style.display =
      member.married &&
      spouseDisplay !== "N/A" &&
      !spouseDisplay.startsWith("Unknown")
        ? "block"
        : "none";

    const marriageDateEl = document.getElementById("sb-marriagedate");
    marriageDateEl.textContent = getText(member.marriageDate);
    // Show marriage date only if married and date is available
    marriageDateEl.closest("p").style.display =
      member.married && member.marriageDate ? "block" : "none";

    let numChildrenText = "0";
    let childrenDisplayNames = "N/A";
    let hasChildren = false;
    if (member.childrenIds && member.childrenIds.length > 0) {
      hasChildren = true;
      numChildrenText = String(member.childrenIds.length);
      const childNameArray = member.childrenIds.map((childId) => {
        const childMember = membersMap.get(childId);
        return childMember ? getText(childMember.fullName) : "Unknown Child";
      });
      childrenDisplayNames = childNameArray.join(", ");
    } else if (
      member.numberOfChildren !== null &&
      member.numberOfChildren !== undefined &&
      member.numberOfChildren > 0
    ) {
      hasChildren = true;
      numChildrenText = String(member.numberOfChildren);
      childrenDisplayNames = `(${member.numberOfChildren} children, names not listed via IDs)`;
    } else if (member.numberOfChildren === 0) {
      numChildrenText = "0";
    }
    document.getElementById("sb-numchildren").textContent = numChildrenText;
    const childrenNamesEl = document.getElementById("sb-childrennames");
    childrenNamesEl.textContent = childrenDisplayNames;
    childrenNamesEl.closest("p").style.display = hasChildren ? "block" : "none";
    document.getElementById("sb-education").textContent = getText(
      member.highestEducationalAttainment
    );
    const courseEl = document.getElementById("sb-course");
    courseEl.textContent = getText(member.collegeCourse);
    courseEl.closest("p").style.display = member.collegeCourse
      ? "block"
      : "none";
    document.getElementById("sb-occupation").textContent = getText(
      member.occupation
    );

    if (sidebar) sidebar.classList.add("open");
  }

  // --- Event Listeners for UI (Sidebar, Settings, Drag Detection) ---
  // Close sidebar when its close button is clicked
  if (closeSidebarButton && sidebar) {
    closeSidebarButton.addEventListener("click", () => {
      sidebar.classList.remove("open");
    });
  } else {
    console.warn("closeSidebarButton or sidebar not found for listener setup.");
  }

  // Global click listener for various UI interactions.
  document.addEventListener("click", (event) => {
    // If a pan operation just occurred, consume this click to prevent unwanted actions (like opening sidebar).
    if (panOccurredSinceMousedown) {
      // This flag is reset later or by the next mousedown.
      return;
    }
    // Close sidebar if clicked outside of it and not on a node or settings elements.
    if (
      sidebar &&
      sidebar.classList.contains("open") &&
      !sidebar.contains(event.target) && // Click is outside sidebar
      !event.target.closest(".node-group") && // Click is not on a family member node
      (!settingsIcon || !settingsIcon.contains(event.target)) && // Click is not on settings icon
      (!settingsMenu || !settingsMenu.contains(event.target)) // Click is not on settings menu
    ) {
      sidebar.classList.remove("open");
    }
    // Close settings menu if clicked outside of it and not on the settings icon.
    if (
      settingsMenu &&
      settingsMenu.classList.contains("settings-menu-visible") &&
      !settingsMenu.contains(event.target) && // Click is outside settings menu
      (!settingsIcon || // Settings icon doesn't exist or...
        (event.target !== settingsIcon && !settingsIcon.contains(event.target))) // Click is not on settings icon itself
    ) {
      settingsMenu.classList.remove("settings-menu-visible");
    }
  });

  // Event listeners on the SVG element to detect potential panning operations.
  if (svgElement) {
    // On mousedown (mouse press) on the SVG area.
    svgElement.addEventListener("mousedown", (e) => {
      // Check if pan is enabled and the click is on the SVG background or pan-zoom viewport.
      if (
        panZoomInstance &&
        panZoomInstance.isPanEnabled() &&
        (e.target === svgElement || e.target.closest(".svg-pan-zoom_viewport"))
      ) {
        isUserPotentiallyPanning = true; // User might start panning.
        panOccurredSinceMousedown = false; // Reset flag: no pan has occurred *yet* for this mousedown.
      }
    });
    // On touchstart (finger press on touch device) on the SVG area.
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
      { passive: true } // `passive: true` for better scroll performance, assuming preventDefault isn't called.
    );

    // On mouseup (mouse release) on the SVG area.
    svgElement.addEventListener("mouseup", () => {
      // If mousedown was on SVG but no pan event fired, it was likely a click on SVG background.
      if (isUserPotentiallyPanning && !panOccurredSinceMousedown) {
        // This block can be used for logic specific to clicking the SVG background.
      }
      isUserPotentiallyPanning = false; // User is no longer potentially panning.
      // Reset panOccurredSinceMousedown after a short delay.
      // This allows the global click listener to check its value first.
      setTimeout(() => {
        panOccurredSinceMousedown = false;
      }, 0);
    });
    // On touchend (finger lift on touch device) on the SVG area.
    svgElement.addEventListener("touchend", () => {
      isUserPotentiallyPanning = false;
      setTimeout(() => {
        panOccurredSinceMousedown = false;
      }, 0);
    });
  }

  // Initializes the svg-pan-zoom library on the SVG element.
  function setupPanZoom() {
    console.log("--- setupPanZoom called (WITH initial fit/center) ---");
    if (typeof svgPanZoom === "undefined") {
      // Check if library is loaded
      console.error("svgPanZoom undefined!");
      return;
    }
    if (!svgElement) {
      // Check if SVG element exists
      console.error("svgElement null!");
      return;
    }
    try {
      panZoomInstance = svgPanZoom(svgElement, {
        zoomEnabled: true,
        panEnabled: true,
        controlIconsEnabled: false, // Disable default UI controls
        dblClickZoomEnabled: true,
        mouseWheelZoomEnabled: true,
        preventMouseEventsDefault: true, // Important for handling events correctly
        zoomScaleSensitivity: 0.2,
        minZoom: 0.1,
        maxZoom: 10,
        fit: true, // Fit the content to the SVG area on initialization
        center: true, // Center the content in the SVG area on initialization
        beforePan: function () {
          // Called right before a pan operation starts.
          if (isUserPotentiallyPanning) {
            panOccurredSinceMousedown = true; // A pan is definitely happening.
          }
        },
        onPan: function (newPan, oldPanVal) {
          // Called during a pan operation.
          if (isUserPotentiallyPanning) {
            panOccurredSinceMousedown = true; // Reinforce that a pan occurred.
          }
          // Optional: Add logic here if particles should react to panning.
        },
        onZoom: function (newZoom) {
          // Called during a zoom operation.
          // Optional: Add logic here if particles should react to zooming.
        },
      });
      console.log("svgPanZoom initialized (WITH initial fit/center).");
      // Log the initial transform matrix after a short delay to ensure it's applied.
      setTimeout(() => {
        const initialMatrix = svgElement
          .querySelector(".svg-pan-zoom_viewport") // Get the viewport group transformed by svg-pan-zoom
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

  // Function to focus the view on the "me" member.
  function focusOnMe() {
    console.log(
      "--- focusOnMe called (Instant - Revised with containerRect) ---"
    );
    if (!panZoomInstance) {
      // Check if panZoom is initialized
      console.warn("PanZoom instance N/A.");
      return;
    }
    const meNode = membersMap.get("me"); // Get the "me" member data
    if (meNode && meNode.x !== undefined && meNode.y !== undefined) {
      // Check if "me" exists and has coordinates
      console.log(
        `Focusing on 'me': ${meNode.name} at x:${meNode.x}, y:${meNode.y}`
      );
      panZoomInstance.resize(); // Ensure panZoom instance considers current SVG size

      console.log(
        `   Attempting zoomAtPoint(${TARGET_ZOOM_LEVEL}, {x: ${meNode.x}, y: ${meNode.y}})`
      );
      // Zoom to the target level, keeping the "me" node's SVG coordinates at the center of the zoom operation.
      panZoomInstance.zoomAtPoint(TARGET_ZOOM_LEVEL, {
        x: meNode.x,
        y: meNode.y,
      });

      // Get current pan and zoom values after zoomAtPoint
      const currentPan = panZoomInstance.getPan();
      const currentZoom = panZoomInstance.getZoom();

      // Get the dimensions of the SVG's parent container (the visible area)
      const containerRect = svgElement.parentElement.getBoundingClientRect();
      const screenCenterX = containerRect.width / 2; // Center X of the visible screen
      const screenCenterY = containerRect.height / 2; // Center Y of the visible screen

      // Calculate the "me" node's current position on the screen
      // ScreenPos = (SVG_Coord * Zoom) + Pan
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

      // Calculate the difference needed to pan the "me" node to the screen center
      const dx = screenCenterX - meNodeScreenX;
      const dy = screenCenterY - meNodeScreenY;

      // If the node is not already centered (within a small tolerance), apply a pan correction.
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        console.log(
          `   Applying panBy correction (immediate): dx=${dx.toFixed(
            1
          )}, dy=${dy.toFixed(1)}`
        );
        panZoomInstance.panBy({ x: dx, y: dy }); // Pan by the calculated difference
      } else {
        console.log(
          "   'me' node is already centered enough. No pan correction needed."
        );
      }

      // Log final state after a short delay
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
      // If "me" node exists but coordinates are not set (shouldn't happen if rendering is correct)
      console.warn("'me' node pos not set. Fallback.");
      panZoomInstance.fit(); // Fit entire tree
      panZoomInstance.center(); // Center entire tree
    } else {
      // If "me" node is not found in data
      console.warn("'me' node not found. Fallback.");
      panZoomInstance.fit();
      panZoomInstance.center();
    }
  }

  // --- Main Execution Order ---
  // Check if required libraries are loaded.
  if (typeof svgPanZoom === "undefined") {
    console.error("svgPanZoom NOT LOADED!");
  }
  if (typeof tsParticles === "undefined") {
    console.error("tsParticles NOT LOADED!");
  }

  // Start gradient animation if the control slider exists.
  if (gradientSpeedSlider) {
    requestAnimationFrame(updateGradientColors);
  } else {
    console.warn(
      "Gradient speed slider not found, gradient animation might not use dynamic speed correctly or start."
    );
    // Consider starting updateGradientColors anyway if a default speed is acceptable.
  }

  // Initialize particles.
  await refreshParticles();
  // Set up event listeners for the settings UI.
  setupSettingsMenuEventListeners();
  // Load family data and render the tree. This will also call setupPanZoom and focusOnMe.
  await loadFamilyData();
});

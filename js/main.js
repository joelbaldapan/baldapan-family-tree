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
  function renderTree() {
    if (!svgElement) {
      // Ensure SVG element exists
      return;
    }
    svgElement.innerHTML = ""; // Clear previous tree drawing
    // Reset drawing-related properties for all members
    membersMap.forEach((member) => {
      Object.assign(member, {
        drawn: false,
        calculatedWidth: false,
        x: 0,
        y: 0,
        width: 0,
      });
    });
    // Identify potential root members (those without parents in the dataset)
    const allPotentialRoots = familyData.filter(
      (m) => !m.fatherId && !m.motherId
    );
    let overallOffsetX = 50; // Initial horizontal offset for the first root/tree
    const initialY = NODE_RADIUS + NAME_OFFSET_Y + 30; // Initial vertical position for the first generation

    // Pre-calculate subtree widths for all members to aid in layout
    familyData.forEach((member) => {
      if (!member.calculatedWidth) {
        calculateSubtreeWidth(member.id);
      }
    });

    let drawnRootsSet = new Set(); // Keep track of roots already processed to avoid duplicates (e.g., if a root's partner is also a root)
    allPotentialRoots.forEach((rootCandidate) => {
      const rootMember = membersMap.get(rootCandidate.id);
      // Skip if member doesn't exist, is already drawn, or is part of an already drawn root couple
      if (
        !rootMember ||
        rootMember.drawn ||
        drawnRootsSet.has(rootCandidate.id)
      ) {
        return;
      }
      drawnRootsSet.add(rootCandidate.id); // Mark this root as processed
      // If this root has a partner who is also a potential root, mark the partner as processed too
      if (rootMember.partnerId && membersMap.has(rootMember.partnerId)) {
        if (allPotentialRoots.find((pr) => pr.id === rootMember.partnerId)) {
          drawnRootsSet.add(rootMember.partnerId);
        }
      }

      const rootSubtreeWidth = rootMember.width || NODE_RADIUS * 2; // Get pre-calculated width
      const rootDrawX = overallOffsetX + rootSubtreeWidth / 2; // Calculate X position for this root
      // Start drawing this root and its descendants
      drawMemberAndDescendants(rootMember.id, rootDrawX, initialY, 0);
      // Increment offset for the next independent tree/root
      overallOffsetX += rootSubtreeWidth + HORIZONTAL_SPACING_SIBLINGS * 1.5;
    });
  }

  // Recursively calculates the horizontal width required by a member and their descendants.
  function calculateSubtreeWidth(memberId) {
    const member = membersMap.get(memberId);
    if (!member || member.calculatedWidth) return member ? member.width : 0; // Return if already calculated or member not found

    // Base width for a single member or a member without a partner considered yet
    let coupleUnitWidth = NODE_RADIUS * 2;
    if (member.partnerId) {
      // If member has a partner, the couple unit width is larger
      coupleUnitWidth = HORIZONTAL_SPACING_PARTNERS + NODE_RADIUS * 2;
    }

    let childrenBlockWidth = 0; // Total width required by all children
    const partner = member.partnerId ? membersMap.get(member.partnerId) : null;

    // Calculate children's width only for one parent in a couple (e.g., the one with the smaller ID, or if no partner)
    // This prevents children width from being calculated twice or from the "wrong" parent in layout.
    if (
      member.childrenIds &&
      member.childrenIds.length > 0 &&
      (!partner || member.id < partner.id || !membersMap.has(member.partnerId))
    ) {
      member.childrenIds.forEach((childId, index) => {
        childrenBlockWidth += calculateSubtreeWidth(childId); // Recursively calculate child's subtree width
        if (index < member.childrenIds.length - 1) {
          childrenBlockWidth += HORIZONTAL_SPACING_SIBLINGS; // Add spacing between siblings
        }
      });
    }
    // The member's total width is the maximum of their couple unit width and their children's block width
    member.width = Math.max(coupleUnitWidth, childrenBlockWidth);
    member.calculatedWidth = true; // Mark as calculated
    return member.width;
  }

  // Recursively draws a member, their partner, and their descendants.
  function drawMemberAndDescendants(memberId, x, y, level) {
    const member = membersMap.get(memberId);
    if (!member || member.drawn) {
      // Skip if member not found or already drawn
      return;
    }
    member.x = x; // Set member's X position
    member.y = y; // Set member's Y position
    drawNode(member); // Draw the visual representation (circle, name)
    member.drawn = true; // Mark as drawn

    let coupleMidX = x; // Midpoint X for the couple (defaults to member's X if no partner)

    // Draw partner if exists and not already drawn
    if (member.partnerId) {
      const partner = membersMap.get(member.partnerId);
      if (partner && !partner.drawn) {
        partner.x = x + HORIZONTAL_SPACING_PARTNERS; // Position partner to the right
        partner.y = y;
        drawNode(partner);
        partner.drawn = true;
        // Draw horizontal line connecting spouses
        const line = createSVGElement("line", {
          x1: member.x + NODE_RADIUS + SPOUSE_LINE_MARGIN,
          y1: member.y,
          x2: partner.x - NODE_RADIUS - SPOUSE_LINE_MARGIN,
          y2: partner.y,
          class: "connection-line spouse-line",
        });
        svgElement.appendChild(line);
        coupleMidX = (member.x + partner.x) / 2; // Update couple midpoint
      } else if (partner && partner.drawn) {
        // If partner already drawn (e.g., processed as a root), still calculate midpoint
        coupleMidX = (member.x + partner.x) / 2;
      }
    }

    // Check which parent should be responsible for drawing children
    // (typically the one with the smaller ID, or if no partner, this member)
    const partnerForChildrenCheck = member.partnerId
      ? membersMap.get(member.partnerId)
      : null;
    if (
      member.childrenIds &&
      member.childrenIds.length > 0 &&
      (!partnerForChildrenCheck || // If no partner
        member.id < partnerForChildrenCheck.id || // Or this member has smaller ID
        !membersMap.has(member.partnerId)) // Or partner data is missing
    ) {
      const childrenToDraw = member.childrenIds
        .map((id) => membersMap.get(id))
        .filter((c) => c); // Get valid child objects

      if (childrenToDraw.length > 0) {
        const childrenY = y + VERTICAL_SPACING_GENERATIONS; // Y position for the children's generation
        let requiredChildrenBlockWidth = 0;
        // Calculate total width needed for all direct children subtrees
        childrenToDraw.forEach((child, i) => {
          requiredChildrenBlockWidth +=
            membersMap.get(child.id)?.width || NODE_RADIUS * 2; // Use pre-calculated width
          if (i < childrenToDraw.length - 1) {
            requiredChildrenBlockWidth += HORIZONTAL_SPACING_SIBLINGS;
          }
        });

        // Starting X for the children block, centered below the couple midpoint
        let currentChildBlockOriginX =
          coupleMidX - requiredChildrenBlockWidth / 2;

        // Y coordinates for the vertical line from parent(s) to children's horizontal line
        const parentToChildrenLineY1 =
          member.y + (member.partnerId ? 0 : NODE_RADIUS); // Line starts from couple mid-point or bottom of single parent
        const childrenHorizontalLineY =
          parentToChildrenLineY1 + CHILD_H_LINE_Y_OFFSET;

        // Draw vertical line from parent(s) down to the children's horizontal connector line
        const parentToChildrenLine = createSVGElement("line", {
          x1: coupleMidX,
          y1: parentToChildrenLineY1,
          x2: coupleMidX,
          y2: childrenHorizontalLineY,
          class: "connection-line",
        });
        svgElement.appendChild(parentToChildrenLine);

        // If there are multiple children, draw the horizontal line connecting them
        if (childrenToDraw.length > 1) {
          const firstChildMember = membersMap.get(childrenToDraw[0].id);
          const lastChildMember = membersMap.get(
            childrenToDraw[childrenToDraw.length - 1].id
          );
          // X for the start of the horizontal line (center of the first child's subtree)
          const firstChildDrawX =
            currentChildBlockOriginX +
            (firstChildMember?.width || NODE_RADIUS * 2) / 2;
          // X for the end of the horizontal line (center of the last child's subtree)
          const lastChildDrawX =
            coupleMidX + // This calculation seems a bit off, should be based on currentChildBlockOriginX + total width
            requiredChildrenBlockWidth / 2 -
            (lastChildMember?.width || NODE_RADIUS * 2) / 2;

          const childrenHLine = createSVGElement("line", {
            x1: firstChildDrawX,
            y1: childrenHorizontalLineY,
            x2: lastChildDrawX, // Corrected: should be the center of the last child's subtree within the block
            y2: childrenHorizontalLineY,
            class: "connection-line",
          });
          svgElement.appendChild(childrenHLine);
        }

        // Draw each child and their descendants
        childrenToDraw.forEach((child) => {
          if (!child) return;
          const childMember = membersMap.get(child.id);
          const childEffectiveWidth = childMember?.width || NODE_RADIUS * 2; // Use pre-calculated width
          // X position for this child (center of its allocated space)
          const childActualDrawX =
            currentChildBlockOriginX + childEffectiveWidth / 2;

          // Draw vertical line from horizontal connector to the child node
          const childVerticalLine = createSVGElement("line", {
            x1: childActualDrawX,
            y1: childrenHorizontalLineY,
            x2: childActualDrawX,
            y2: childrenY - NODE_RADIUS, // Line ends at top of child's circle
            class: "connection-line",
          });
          svgElement.appendChild(childVerticalLine);

          // Recursively draw this child and its descendants
          drawMemberAndDescendants(
            child.id,
            childActualDrawX,
            childrenY,
            level + 1
          );
          // Move the origin for the next sibling
          currentChildBlockOriginX +=
            childEffectiveWidth + HORIZONTAL_SPACING_SIBLINGS;
        });
      }
    }
  }

  // Draws a single family member node (circle and name).
  function drawNode(member) {
    if (!member || member.x === undefined || member.y === undefined) {
      // Check for valid member and coordinates
      return;
    }
    // Create an SVG group for the node elements
    const group = createSVGElement("g", {
      class: "node-group",
      transform: `translate(${member.x}, ${member.y})`, // Position the group
      "data-id": member.id, // Store member ID for easy access (e.g., for click events)
    });
    // Create the circle
    const circle = createSVGElement("circle", {
      cx: 0, // Centered within the group
      cy: 0, // Centered within the group
      r: NODE_RADIUS,
      class: `node-circle ${member.gender || "other"}`, // Class for styling based on gender
    });
    // Create the text for the name
    const nameText = createSVGElement("text", {
      x: 0, // Centered horizontally
      y: NODE_RADIUS + NAME_OFFSET_Y, // Positioned below the circle
      class: "node-name",
    });
    nameText.textContent = member.name; // Set the name

    group.appendChild(circle);
    group.appendChild(nameText);
    if (svgElement) {
      svgElement.appendChild(group); // Add the group to the main SVG
    }
    // Add click listener to show sidebar with this member's details
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
    const member = membersMap.get(memberId); // Get member data from the map
    if (!member) {
      return;
    }
    // Populate sidebar fields with member's data
    document.getElementById("sidebar-name").textContent = member.name;
    document.getElementById("sb-birthday").textContent =
      member.birthDate || "N/A";
    document.getElementById("sb-gender").textContent = member.gender
      ? member.gender.charAt(0).toUpperCase() + member.gender.slice(1) // Capitalize gender
      : "N/A";
    const deathDateEl = document.getElementById("sb-deathdate");
    deathDateEl.textContent = member.deathDate || "N/A";
    // Show/hide death date field based on availability
    deathDateEl.closest("p").style.display = member.deathDate
      ? "block"
      : "none";
    document.getElementById("sb-father").textContent = member.fatherId
      ? membersMap.get(member.fatherId)?.name || "N/A" // Get father's name
      : "N/A";
    document.getElementById("sb-mother").textContent = member.motherId
      ? membersMap.get(member.motherId)?.name || "N/A" // Get mother's name
      : "N/A";
    let marriedText = "No";
    if (member.partnerId) {
      const partner = membersMap.get(member.partnerId);
      marriedText = partner
        ? `Yes, to ${partner.name}` // Show partner's name
        : "Yes (partner data missing)";
    }
    document.getElementById("sb-married").textContent = marriedText;
    const marriageDateEl = document.getElementById("sb-marriagedate");
    marriageDateEl.textContent = member.marriageDate || "N/A";
    // Show/hide marriage date field
    marriageDateEl.closest("p").style.display = member.marriageDate
      ? "block"
      : "none";
    document.getElementById("sb-education").textContent =
      member.highestEducationalAttainment || "N/A";
    const courseEl = document.getElementById("sb-course");
    courseEl.textContent = member.collegeCourse || "N/A";
    // Show/hide college course field
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
    // Show/hide move reason field
    moveReasonEl.closest("p").style.display =
      member.plansToMoveOut && member.plansToMoveOutReason ? "block" : "none";

    if (sidebar) sidebar.classList.add("open"); // Open the sidebar
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

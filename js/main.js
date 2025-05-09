document.addEventListener('DOMContentLoaded', () => {
    const svgNS = "http://www.w3.org/2000/svg";
    const svgElement = document.getElementById('family-tree-svg');
    const sidebar = document.getElementById('sidebar');
    const closeSidebarButton = document.getElementById('close-sidebar');

    // --- Configuration Constants ---
    const NODE_RADIUS = 30;
    const NAME_OFFSET_Y = 15; // Space between circle bottom and name top
    const HORIZONTAL_SPACING_PARTNERS = NODE_RADIUS * 2 + 60; // Space between centers of partner nodes
    const HORIZONTAL_SPACING_SIBLINGS = NODE_RADIUS * 2 + 30; // Space between centers of sibling nodes
    const VERTICAL_SPACING_GENERATIONS = NODE_RADIUS * 2 + 80; // Space between parent line and child line
    const SPOUSE_LINE_MARGIN = 5; // How far spouse line extends from node edge

    // Initial viewport size for SVG (can be larger than screen)
    const SVG_WIDTH = 3000;
    const SVG_HEIGHT = 2000;
    svgElement.setAttribute('width', SVG_WIDTH);
    svgElement.setAttribute('height', SVG_HEIGHT);
    svgElement.setAttribute('viewBox', `0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`);


    let familyData = [];
    let membersMap = new Map(); // For quick lookup by ID
    let panZoomInstance;

    // --- 1. Fetch and Process Data ---
    async function loadFamilyData() {
        try {
            const response = await fetch('js/familyData.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            familyData = await response.json();
            familyData.forEach(member => {
                membersMap.set(member.id, member);
                // Initialize coordinates (will be calculated by layout algorithm)
                member.x = 0;
                member.y = 0;
                member.width = 0; // Width of the subtree rooted at this member
            });
            renderTree();
            setupPanZoom();
            focusOnMe();
        } catch (error) {
            console.error("Could not load family data:", error);
            svgElement.innerHTML = `<text x="10" y="30" fill="red">Error loading family data. Check console.</text>`;
        }
    }

    // --- 2. Render Tree ---
    function renderTree() {
        svgElement.innerHTML = ''; // Clear previous tree

        // Identify root individuals (those without parents listed or explicitly defined as root)
        // For simplicity, we'll assume the first individuals in the JSON without fatherId/motherId are roots.
        // A more robust way is to have a "isRoot" flag or find those not in anyone's childrenIds.
        const roots = familyData.filter(m => !m.fatherId && !m.motherId);

        if (roots.length === 0 && familyData.length > 0) {
            console.warn("No root individuals found. Tree might not render correctly. Assuming first member is a root.");
            if(familyData[0]) roots.push(familyData[0]);
        }
        
        // --- Layout Calculation (Simplified Depth-First approach) ---
        // This is a basic layout. More sophisticated algorithms (e.g., Reingold-Tilford)
        // handle complex cases and overlaps better but are much harder to implement.
        // This one will likely need manual tweaking of constants or data order for optimal aesthetics.
        
        let currentX = SVG_WIDTH / 2; // Start drawing roughly in the middle (can be adjusted)
        const initialY = NODE_RADIUS + NAME_OFFSET_Y + 20; // Top padding

        // Calculate subtree widths (bottom-up pass)
        function calculateSubtreeWidth(memberId) {
            const member = membersMap.get(memberId);
            if (!member) return 0;
            if (member.calculatedWidth) return member.width; // Memoization

            let width = NODE_RADIUS * 2; // Width of the node itself
            let partnerWidth = 0;

            if (member.partnerId) {
                partnerWidth = NODE_RADIUS * 2 + HORIZONTAL_SPACING_PARTNERS - (NODE_RADIUS*2); // Space for partner
            }

            let childrenWidth = 0;
            if (member.childrenIds && member.childrenIds.length > 0) {
                // Only consider children if this member is likely the "primary" parent for layout
                // (e.g., if partnerId is also set, or by convention like father)
                // This avoids double counting children width for a couple.
                // Let's assume children are processed when the 'first' parent (e.g. by ID sort) is encountered.
                const partner = member.partnerId ? membersMap.get(member.partnerId) : null;
                if (!partner || member.id < partner.id) { // Process children only for one parent in a couple
                    member.childrenIds.forEach((childId, index) => {
                        childrenWidth += calculateSubtreeWidth(childId);
                        if (index < member.childrenIds.length - 1) {
                            childrenWidth += HORIZONTAL_SPACING_SIBLINGS - (NODE_RADIUS*2);
                        }
                    });
                }
            }
            
            // The width of this node's display unit (person + partner)
            let selfUnitWidth = NODE_RADIUS * 2 + (member.partnerId ? HORIZONTAL_SPACING_PARTNERS : 0);

            member.width = Math.max(selfUnitWidth, childrenWidth);
            member.calculatedWidth = true;
            return member.width;
        }

        // Call width calculation for all roots
        roots.forEach(root => calculateSubtreeWidth(root.id));


        let overallOffsetX = 50; // Initial X offset for the entire tree
        roots.forEach(root => {
            // For multiple root families, lay them out side by side
            drawMemberAndDescendants(root.id, overallOffsetX, initialY, 0);
            overallOffsetX += (membersMap.get(root.id)?.width || NODE_RADIUS * 4) + 100; // Add width of this root's tree + spacing
        });
    }

    // Recursive function to draw a member, their spouse, and their descendants
    // x, y are for the current member
    function drawMemberAndDescendants(memberId, x, y, level) {
        const member = membersMap.get(memberId);
        if (!member || member.drawn) return 0; // Already drawn or not found

        member.x = x;
        member.y = y;
        drawNode(member);
        member.drawn = true; // Mark as drawn to avoid cycles/redraws

        let currentSubtreeWidth = NODE_RADIUS * 2;
        let coupleMidX = x; // Midpoint for children connection

        // Draw partner if exists
        if (member.partnerId) {
            const partner = membersMap.get(member.partnerId);
            if (partner && !partner.drawn) {
                partner.x = x + HORIZONTAL_SPACING_PARTNERS;
                partner.y = y;
                drawNode(partner);
                partner.drawn = true;
                
                // Spouse connection line
                const line = createSVGElement('line', {
                    x1: member.x + NODE_RADIUS + SPOUSE_LINE_MARGIN,
                    y1: member.y,
                    x2: partner.x - NODE_RADIUS - SPOUSE_LINE_MARGIN,
                    y2: partner.y,
                    class: 'connection-line spouse-line'
                });
                svgElement.appendChild(line);
                coupleMidX = (member.x + partner.x) / 2;
                currentSubtreeWidth += HORIZONTAL_SPACING_PARTNERS;
            } else if (partner) { // Partner exists but already drawn (e.g. started from partner)
                 coupleMidX = (member.x + partner.x) / 2;
            }
        }

        // Draw children
        if (member.childrenIds && member.childrenIds.length > 0) {
            const children = member.childrenIds.map(id => membersMap.get(id)).filter(c => c && !c.drawn);
            
            if (children.length > 0) {
                const childrenY = y + VERTICAL_SPACING_GENERATIONS;
                const totalChildrenWidth = children.reduce((sum, child) => sum + (child.width || NODE_RADIUS * 2), 0) +
                                       Math.max(0, children.length - 1) * (HORIZONTAL_SPACING_SIBLINGS - NODE_RADIUS * 2);
                
                let childStartX = coupleMidX - totalChildrenWidth / 2 + NODE_RADIUS;

                // Parent-to-children line (vertical part)
                const parentToChildrenLine = createSVGElement('line', {
                    x1: coupleMidX,
                    y1: member.y + (member.partnerId ? 0 : NODE_RADIUS), // From mid of couple line or bottom of single parent
                    x2: coupleMidX,
                    y2: childrenY - NODE_RADIUS - 10, // Connect to above children line/nodes
                    class: 'connection-line'
                });
                svgElement.appendChild(parentToChildrenLine);

                // Children horizontal connector line (if multiple children)
                if (children.length > 1) {
                    const firstChildEffectiveX = childStartX;
                    const lastChildEffectiveX = childStartX + totalChildrenWidth - (NODE_RADIUS*2);
                    const childrenHLine = createSVGElement('line', {
                        x1: firstChildEffectiveX,
                        y1: childrenY - NODE_RADIUS - 10,
                        x2: lastChildEffectiveX,
                        y2: childrenY - NODE_RADIUS - 10,
                        class: 'connection-line'
                    });
                    svgElement.appendChild(childrenHLine);
                     // Connect parent line to this horizontal line
                    parentToChildrenLine.setAttribute('y2', childrenY - NODE_RADIUS - 10);
                }


                let currentChildX = childStartX;
                children.forEach((child, index) => {
                    if (!child || child.drawn) return;

                    const childActualX = currentChildX; // Center of the child node

                    // Line from horizontal children line to child node
                    const childVerticalLine = createSVGElement('line', {
                        x1: childActualX,
                        y1: childrenY - NODE_RADIUS - (children.length > 1 ? 10:0) , // from children H-line or parent connector
                        x2: childActualX,
                        y2: childrenY - NODE_RADIUS, // To top of child circle
                        class: 'connection-line'
                    });
                    svgElement.appendChild(childVerticalLine);
                    
                    const childSubtreeWidth = drawMemberAndDescendants(child.id, childActualX, childrenY, level + 1);
                    currentChildX += (child.width || NODE_RADIUS * 2) + (HORIZONTAL_SPACING_SIBLINGS - NODE_RADIUS*2);
                });
                currentSubtreeWidth = Math.max(currentSubtreeWidth, totalChildrenWidth);
            }
        }
        member.actualWidth = currentSubtreeWidth; // Store the calculated width for this node's drawing
        return currentSubtreeWidth;
    }


    function drawNode(member) {
        if (!member) return;

        const group = createSVGElement('g', {
            class: 'node-group',
            transform: `translate(${member.x}, ${member.y})`,
            'data-id': member.id
        });

        const circle = createSVGElement('circle', {
            cx: 0,
            cy: 0,
            r: NODE_RADIUS,
            class: `node-circle ${member.gender || 'other'}`
        });

        const nameText = createSVGElement('text', {
            x: 0,
            y: NODE_RADIUS + NAME_OFFSET_Y,
            class: 'node-name'
        });
        nameText.textContent = member.name;

        group.appendChild(circle);
        group.appendChild(nameText);
        svgElement.appendChild(group);

        group.addEventListener('click', () => showSidebar(member.id));
    }

    function createSVGElement(tag, attributes) {
        const el = document.createElementNS(svgNS, tag);
        for (const attr in attributes) {
            el.setAttribute(attr, attributes[attr]);
        }
        return el;
    }


    // --- 3. Sidebar Logic ---
    function showSidebar(memberId) {
        const member = membersMap.get(memberId);
        if (!member) return;

        document.getElementById('sidebar-name').textContent = member.name;
        document.getElementById('sb-birthday').textContent = member.birthDate || 'N/A';
        document.getElementById('sb-gender').textContent = member.gender ? (member.gender.charAt(0).toUpperCase() + member.gender.slice(1)) : 'N/A';
        
        const deathDateEl = document.getElementById('sb-deathdate');
        deathDateEl.textContent = member.deathDate || 'N/A';
        deathDateEl.closest('p').style.display = member.deathDate ? 'block' : 'none';

        document.getElementById('sb-father').textContent = member.fatherId ? (membersMap.get(member.fatherId)?.name || 'N/A') : 'N/A';
        document.getElementById('sb-mother').textContent = member.motherId ? (membersMap.get(member.motherId)?.name || 'N/A') : 'N/A';
        
        let marriedText = 'No';
        if (member.partnerId) {
            const partner = membersMap.get(member.partnerId);
            marriedText = partner ? `Yes, to ${partner.name}` : 'Yes (partner data missing)';
        }
        document.getElementById('sb-married').textContent = marriedText;
        
        const marriageDateEl = document.getElementById('sb-marriagedate');
        marriageDateEl.textContent = member.marriageDate || 'N/A';
        marriageDateEl.closest('p').style.display = member.marriageDate ? 'block' : 'none';


        document.getElementById('sb-education').textContent = member.highestEducationalAttainment || 'N/A';
        
        const courseEl = document.getElementById('sb-course');
        courseEl.textContent = member.collegeCourse || 'N/A';
        courseEl.closest('p').style.display = member.collegeCourse ? 'block' : 'none';

        document.getElementById('sb-occupation').textContent = member.occupation || 'N/A';
        document.getElementById('sb-urban').textContent = member.grewUpInUrban === null ? 'N/A' : (member.grewUpInUrban ? 'Yes' : 'No');
        
        const plansToMoveEl = document.getElementById('sb-moveplans');
        plansToMoveEl.textContent = member.plansToMoveOut === null ? 'N/A' : (member.plansToMoveOut ? 'Yes' : 'No');
        
        const moveReasonEl = document.getElementById('sb-movereason');
        moveReasonEl.textContent = member.plansToMoveOutReason || 'N/A';
        moveReasonEl.closest('p').style.display = (member.plansToMoveOut && member.plansToMoveOutReason) ? 'block' : 'none';

        sidebar.classList.add('open');
    }

    closeSidebarButton.addEventListener('click', () => {
        sidebar.classList.remove('open');
    });

    // Close sidebar if clicked outside
    document.addEventListener('click', (event) => {
        if (!sidebar.contains(event.target) && !event.target.closest('.node-group') && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
        }
    });


    // --- 4. Pan and Zoom ---
    function setupPanZoom() {
        panZoomInstance = svgPanZoom('#family-tree-svg', {
            zoomEnabled: true,
            panEnabled: true,
            controlIconsEnabled: false, // You can enable default controls if you like
            dblClickZoomEnabled: true,
            mouseWheelZoomEnabled: true,
            preventMouseEventsDefault: true,
            zoomScaleSensitivity: 0.2,
            minZoom: 0.2,
            maxZoom: 5,
            fit: false,      // Do not fit initially, we'll center on "me"
            center: false,   // Do not center initially
            // beforePan: beforePan // Can be useful for custom logic
        });
    }

    // --- 5. Focus on "me" ---
    function focusOnMe() {
        const meNode = familyData.find(m => m.id === 'me');
        if (meNode && panZoomInstance && meNode.x && meNode.y) {
            panZoomInstance.zoom(1); // Reset zoom to a sensible level
            
            // Pan to center the "me" node
            // The panzoom library pans the viewBox, so we need to calculate the target viewBox x/y
            // to make meNode.x, meNode.y appear in the center of the SVG container.
            const svgRect = svgElement.getBoundingClientRect();
            const targetX = meNode.x;
            const targetY = meNode.y;
            
            // Get current zoom level
            const currentZoom = panZoomInstance.getSizes().realZoom;
            
            // Calculate desired pan values
            // (center of view) - (node position * zoom)
            const panX = (svgRect.width / 2 / currentZoom) - targetX;
            const panY = (svgRect.height / 2 / currentZoom) - targetY;

            panZoomInstance.pan({ x: panX * currentZoom, y: panY * currentZoom });

        } else if (meNode && !meNode.x) {
             console.warn("'me' node found, but position not yet calculated. Focusing might be off.");
        } else if (panZoomInstance) {
            console.warn("'me' node not found in data. Cannot auto-focus.");
            // Fallback: Fit and center the whole tree if "me" is not found
            panZoomInstance.fit();
            panZoomInstance.center();
        }
    }

    // Start loading data
    loadFamilyData();
});
/**
 * createAircraftModel()
 * Kavisli LatheGeometry gövdeli sabit kanatlı uçak.
 * Burun +Z, kanatlar ±X, üst +Y yönünde.
 */
function createAircraftModel() {
    const group = new THREE.Group();

    const yellow    = new THREE.MeshStandardMaterial({ color: 0xFFD700, roughness: 0.40, metalness: 0.18 });
    const darkGrey  = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7,  metalness: 0.15 });
    const cockpitMat= new THREE.MeshStandardMaterial({
        color: 0x66aaee, roughness: 0.05, metalness: 0.1,
        transparent: true, opacity: 0.50
    });

    // ── Kavisli gövde — LatheGeometry ─────────────────────────────────
    // Profil: (yarıçap, y) — yüksek y = burun tarafı
    // makeRotationX(PI/2) sonrası y → +Z
    const profilePts = [
        new THREE.Vector2(0.01,  -2.30),  // kuyruk ucu
        new THREE.Vector2(0.06,  -2.10),
        new THREE.Vector2(0.13,  -1.80),
        new THREE.Vector2(0.20,  -1.30),
        new THREE.Vector2(0.26,  -0.60),
        new THREE.Vector2(0.29,   0.00),  // maksimum gövde çapı
        new THREE.Vector2(0.29,   0.50),
        new THREE.Vector2(0.27,   0.90),  // kabin bölgesi
        new THREE.Vector2(0.24,   1.20),
        new THREE.Vector2(0.18,   1.60),
        new THREE.Vector2(0.10,   1.95),
        new THREE.Vector2(0.01,   2.25),  // burun ucu
    ];
    const fuseGeo = new THREE.LatheGeometry(profilePts, 24);
    fuseGeo.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2));
    group.add(new THREE.Mesh(fuseGeo, yellow));

    // ── Ana kanatlar ──────────────────────────────────────────────────
    function makeWing(side) {
        const shape = new THREE.Shape();
        shape.moveTo(0,           -0.15);   // kök arka
        shape.lineTo(side * 2.8,  -0.38);   // uç arka
        shape.lineTo(side * 2.8,   0.22);   // uç ön
        shape.lineTo(0,            0.65);   // kök ön
        shape.closePath();
        const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.09, bevelEnabled: false });
        geo.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2));
        const mesh = new THREE.Mesh(geo, yellow);
        mesh.position.set(0, -0.05, -0.10);
        return mesh;
    }
    group.add(makeWing( 1));
    group.add(makeWing(-1));

    // ── Yatay stabilizatörler ──────────────────────────────────────────
    function makeStab(side) {
        const shape = new THREE.Shape();
        shape.moveTo(0,          -0.05);
        shape.lineTo(side * 1.0, -0.18);
        shape.lineTo(side * 1.0,  0.12);
        shape.lineTo(0,           0.32);
        shape.closePath();
        const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false });
        geo.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2));
        const mesh = new THREE.Mesh(geo, yellow);
        mesh.position.set(0, 0.06, -1.90);
        return mesh;
    }
    group.add(makeStab( 1));
    group.add(makeStab(-1));

    // ── Dikey stabilizatör (kuyruk fini) ──────────────────────────────
    // Shape XY düzleminde: X = chord yönü, Y = yükseklik
    // makeRotationY(-PI/2) sonrası: eski X → yeni -Z (chord Z boyunca uzar),
    // eski Z extrusion → yeni X (ince kalınlık X'te)
    const finShape = new THREE.Shape();
    //              (chord_x,  height_y)
    finShape.moveTo( 0.55,  0.00);   // arka alt kenar (trailing-root)
    finShape.lineTo( 0.40,  0.95);   // arka üst kenar (trailing-tip) — hafif sweep
    finShape.lineTo( 0.05,  1.10);   // tepe
    finShape.lineTo(-0.30,  0.55);   // ön üst kenar (leading-tip)
    finShape.lineTo(-0.22,  0.00);   // ön alt kenar (leading-root)
    finShape.closePath();
    const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.07, bevelEnabled: false });
    // Döndür: chord X→ -Z, extrusion Z→ X
    finGeo.applyMatrix4(new THREE.Matrix4().makeRotationY(-Math.PI / 2));
    const fin = new THREE.Mesh(finGeo, yellow);
    // Şekil X merkezi ≈ (0.55-0.22)/2 = 0.165 → world Z offset = -0.165
    // Extrusion X: 0..0.07 → fin center X = -0.035
    fin.position.set(-0.035, 0.20, -1.735);
    group.add(fin);

    // ── Pervane göbeği ─────────────────────────────────────────────────
    const hubGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.14, 14);
    hubGeo.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2));
    const hub = new THREE.Mesh(hubGeo, darkGrey);
    hub.position.z = 2.30;
    group.add(hub);

    // ── Pervane ────────────────────────────────────────────────────────
    const propGroup = new THREE.Group();
    propGroup.position.z = 2.38;
    for (let i = 0; i < 2; i++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.80, 0.025), darkGrey);
        blade.rotation.z = i * Math.PI;
        propGroup.add(blade);
    }
    group.add(propGroup);
    group.userData.propeller = propGroup;

    // ── Cockpit camı ──────────────────────────────────────────────────
    const cockpitGeo = new THREE.SphereGeometry(0.17, 14, 9, 0, Math.PI * 2, 0, Math.PI * 0.52);
    const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
    cockpit.position.set(0, 0.22, 0.80);
    group.add(cockpit);

    return group;
}

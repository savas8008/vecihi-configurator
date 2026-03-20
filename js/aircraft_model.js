/**
 * createAircraftModel()
 * Three.js primitiflerinden oluşturulan sabit kanatlı uçak modeli.
 * Burun +Z yönüne, kanatlar +/-X yönüne, üst +Y yönüne bakar.
 */
function createAircraftModel() {
    const group = new THREE.Group();

    const yellow    = new THREE.MeshStandardMaterial({ color: 0xFFD700, roughness: 0.45, metalness: 0.15 });
    const darkGrey  = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.7,  metalness: 0.1  });
    const cockpitMat= new THREE.MeshStandardMaterial({
        color: 0x88ccff, roughness: 0.1, metalness: 0.05,
        transparent: true, opacity: 0.55
    });

    // Gövde (fuselage)
    const fuseGeo = new THREE.CylinderGeometry(0.18, 0.12, 2.6, 16);
    fuseGeo.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2));
    group.add(new THREE.Mesh(fuseGeo, yellow));

    // Burun konisi
    const noseGeo = new THREE.ConeGeometry(0.18, 0.55, 16);
    noseGeo.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
    const nose = new THREE.Mesh(noseGeo, yellow);
    nose.position.z = 1.575;
    group.add(nose);

    // Kuyruk konisi
    const tailGeo = new THREE.ConeGeometry(0.12, 0.4, 16);
    tailGeo.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2));
    const tailCone = new THREE.Mesh(tailGeo, yellow);
    tailCone.position.z = -1.5;
    group.add(tailCone);

    // Ana kanatlar
    function makeWing(side) {
        const shape = new THREE.Shape();
        shape.moveTo(0,           0);
        shape.lineTo(side * 2.2, -0.22);
        shape.lineTo(side * 2.2, -0.05);
        shape.lineTo(0,           0.38);
        shape.closePath();
        const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.055, bevelEnabled: false });
        geo.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2));
        const mesh = new THREE.Mesh(geo, yellow);
        mesh.position.set(0, -0.03, -0.05);
        return mesh;
    }
    group.add(makeWing(1));
    group.add(makeWing(-1));

    // Yatay stabilizatörler
    function makeStab(side) {
        const shape = new THREE.Shape();
        shape.moveTo(0,           0);
        shape.lineTo(side * 0.75, -0.1);
        shape.lineTo(side * 0.75,  0.02);
        shape.lineTo(0,            0.18);
        shape.closePath();
        const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false });
        geo.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2));
        const mesh = new THREE.Mesh(geo, yellow);
        mesh.position.set(0, 0.04, -1.55);
        return mesh;
    }
    group.add(makeStab(1));
    group.add(makeStab(-1));

    // Dikey stabilizatör (kuyruk fini)
    const finShape = new THREE.Shape();
    finShape.moveTo(0,     0);
    finShape.lineTo(-0.3,  0.6);
    finShape.lineTo(-0.05, 0.65);
    finShape.lineTo(0.22,  0.1);
    finShape.closePath();
    const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.04, bevelEnabled: false });
    const fin = new THREE.Mesh(finGeo, yellow);
    fin.position.set(-0.02, 0.10, -1.55);
    group.add(fin);

    // Pervane göbeği
    const hubGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.12, 12);
    hubGeo.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2));
    const hub = new THREE.Mesh(hubGeo, darkGrey);
    hub.position.z = 1.87;
    group.add(hub);

    // Pervane
    const propGroup = new THREE.Group();
    propGroup.position.z = 1.93;
    for (let i = 0; i < 2; i++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.72, 0.02), darkGrey);
        blade.rotation.z = i * Math.PI;
        propGroup.add(blade);
    }
    group.add(propGroup);
    group.userData.propeller = propGroup;

    // Cockpit camı
    const cockpitGeo = new THREE.SphereGeometry(0.14, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
    cockpit.position.set(0, 0.16, 0.7);
    group.add(cockpit);

    return group;
}

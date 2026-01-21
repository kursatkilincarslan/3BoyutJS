export function matrixMultiply(a, b) {
    const result = [];
    for (let i = 0; i < a.length; i++) {
        result[i] = [];
        for (let j = 0; j < b[0].length; j++) {
            let sum = 0;
            for (let k = 0; k < a[0].length; k++) {
                sum += a[i][k] * b[k][j];
            }
            result[i][j] = sum;
        }
    }
    return result;
}

export function multiplyList(matrices) {
    let result = matrices[0];
    for (let i = 1; i < matrices.length; i++) {
        result = matrixMultiply(result, matrices[i]);
    }
    return result;
}

export function multiplyMatVec(m, v) {
    return [
        m[0][0]*v[0] + m[0][1]*v[1] + m[0][2]*v[2] + m[0][3]*v[3],
        m[1][0]*v[0] + m[1][1]*v[1] + m[1][2]*v[2] + m[1][3]*v[3],
        m[2][0]*v[0] + m[2][1]*v[1] + m[2][2]*v[2] + m[2][3]*v[3],
        m[3][0]*v[0] + m[3][1]*v[1] + m[3][2]*v[2] + m[3][3]*v[3]
    ];
}

export function normalize(v) {
    const len = Math.hypot(v[0], v[1], v[2]);
    return [v[0]/len, v[1]/len, v[2]/len];
}

export function cross(a, b) {
    return [
        a[1]*b[2] - a[2]*b[1],
        a[2]*b[0] - a[0]*b[2],
        a[0]*b[1] - a[1]*b[0]
    ];
}

export function dot(a, b) {
    return a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
}

export function multiplyHexColor(baseColor, lightColor, intensity = 1) {
    let r1 = parseInt(baseColor.slice(1,3), 16);
    let g1 = parseInt(baseColor.slice(3,5), 16);
    let b1 = parseInt(baseColor.slice(5,7), 16);

    let r2 = parseInt(lightColor.slice(1,3), 16);
    let g2 = parseInt(lightColor.slice(3,5), 16);
    let b2 = parseInt(lightColor.slice(5,7), 16);

    let r = Math.min(255, Math.floor((r1/255)*(r2/255)*intensity*255));
    let g = Math.min(255, Math.floor((g1/255)*(g2/255)*intensity*255));
    let b = Math.min(255, Math.floor((b1/255)*(b2/255)*intensity*255));

    return "#" + r.toString(16).padStart(2,'0') +
                 g.toString(16).padStart(2,'0') +
                 b.toString(16).padStart(2,'0');
}

export function sortTrianglesByDepth(triangles) {
    return triangles.sort((a, b) => {
        const zA = (a.vertices[0].relative_position[2] +
                    a.vertices[1].relative_position[2] +
                    a.vertices[2].relative_position[2]) / 3;
        const zB = (b.vertices[0].relative_position[2] +
                    b.vertices[1].relative_position[2] +
                    b.vertices[2].relative_position[2]) / 3;
        return zB - zA;
    });
}

export class Vertex {
    constructor(x, y, z, w = 1) {
        this.relative_position = [x, y, z, w];
    }
}

export class Triangle {
    constructor(v1, v2, v3, color = "#868686") {
        this.vertices = [v1, v2, v3];
        this.color = color;
    }
}

export class Packet {
    constructor(triangles) {
        this.triangles = triangles;
        this._initVertices();
    }

    getTriangles() {
        return this.triangles;
    }

    setTriangles(triangles) {
        this.triangles = triangles;
        this._initVertices();
    }

    _initVertices() {
        let id = 0;
        this.vertices = [];
        this.triangles.forEach(tri => {
            tri.vertices.forEach((v, idx) => {
                if (!v) throw new Error(`Triangle has undefined vertex at index ${idx}`);
                if (v.id === undefined) {
                    v.id = id++;
                    v.neighbors = new Set();
                }
                this.vertices.push(v);
            });
        });

        this.triangles.forEach(tri => {
            const [v0,v1,v2] = tri.vertices;
            v0.neighbors.add(v1); v0.neighbors.add(v2);
            v1.neighbors.add(v0); v1.neighbors.add(v2);
            v2.neighbors.add(v0); v2.neighbors.add(v1);
        });
    }

    subdivision() {
        const oldTriangles = this.triangles;
        const newTriangles = [];
        const edgeMap = new Map();

        function edgeKey(v1, v2) {
            if (!v1 || !v2) throw new Error("Bir sorun oluştu: Kenar vertexleri tanımsız.");
            return v1.id < v2.id ? `${v1.id}-${v2.id}` : `${v2.id}-${v1.id}`;
        }

        oldTriangles.forEach(tri => {
            if (!tri.vertices || tri.vertices.length !== 3)
                throw new Error("3 kenarlı üçgen bekleniyor.");

            const [v0,v1,v2] = tri.vertices;
            const edges = [
                [v0,v1],[v1,v2],[v2,v0]
            ];
            edges.forEach(([va,vb]) => {
                const key = edgeKey(va,vb);
                if (edgeMap.has(key)) return;

                const oppositeVertices = [];
                oldTriangles.forEach(t => {
                    if (t.vertices.includes(va) && t.vertices.includes(vb)) {
                        t.vertices.forEach(v => {
                            if (v !== va && v !== vb) oppositeVertices.push(v);
                        });
                    }
                });

                let edgePos;
                if (oppositeVertices.length === 2) {
                    edgePos = va.relative_position.map((c,i) =>
                        3/8*(c + vb.relative_position[i]) +
                        1/8*(oppositeVertices[0].relative_position[i] + oppositeVertices[1].relative_position[i])
                    );
                } else {
                    edgePos = va.relative_position.map((c,i) =>
                        (c + vb.relative_position[i]) / 2
                    );
                }

                edgeMap.set(key, new Vertex(...edgePos));
            });
        });

        const newVertices = {};
        this.vertices.forEach(v => {
            const n = v.neighbors.size;
            const beta = n === 3 ? 3/16 : 3/(8*n); 
            const sum = v.neighborsArray ? v.neighborsArray : Array.from(v.neighbors);
            const neighborSum = [0,0,0,0];
            sum.forEach(nb => {
                nb.relative_position.forEach((c,i)=>neighborSum[i]+=c);
            });

            const newPos = v.relative_position.map((c,i) =>
                (1 - n*beta)*c + beta*neighborSum[i]
            );
            newVertices[v.id] = new Vertex(...newPos);
        });

        oldTriangles.forEach(tri => {
            const [v0,v1,v2] = tri.vertices;
            const e0 = edgeMap.get(edgeKey(v0,v1));
            const e1 = edgeMap.get(edgeKey(v1,v2));
            const e2 = edgeMap.get(edgeKey(v2,v0));

            const nv0 = newVertices[v0.id];
            const nv1 = newVertices[v1.id];
            const nv2 = newVertices[v2.id];

            newTriangles.push(new Triangle(nv0,e0,e2, tri.color));
            newTriangles.push(new Triangle(nv1,e1,e0, tri.color));
            newTriangles.push(new Triangle(nv2,e2,e1, tri.color));
            newTriangles.push(new Triangle(e0,e1,e2, tri.color));
        });

        return new Packet(newTriangles);
    }
}

export class Mesh {
    constructor(packet, position = [0,0,0], rotation=[0,0,0], scale=[1,1,1]) {
        this.triangles = packet.triangles;

        this.position = [
            [1,0,0,position[0]],
            [0,1,0,position[1]],
            [0,0,1,position[2]],
            [0,0,0,1]
        ];

        this.rotation = rotation;

        this.scale = [
            [scale[0],0,0,0],
            [0,scale[1],0,0],
            [0,0,scale[2],0],
            [0,0,0,1]
        ];

        this.modelMatrix = [
            [1,0,0,0],
            [0,1,0,0],
            [0,0,1,0],
            [0,0,0,1]
        ];
    }

    getPosition() {
        return [
            this.position[0][3],
            this.position[1][3],
            this.position[2][3]
        ];
    }

    getPositionX() {
        return this.position[0][3];
    }

    getPositionY() {
        return this.position[1][3];
    }

    getPositionZ() {
        return this.position[2][3];
    }

    setPosition(positionList) {
        this.position = positionList;
        this.updateModel();
    }

    setPositionX(x) {
        this.position[0][3] = x;
        this.updateModel();
    }

    setPositionY(y) {
        this.position[1][3] = y;
        this.updateModel();
    }

    setPositionZ(z) {
        this.position[2][3] = z;
        this.updateModel();
    }

    getRotation() {
        return this.rotation;
    }

    getRotationX() {
        return this.rotation[0];
    }

    getRotationY() {
        return this.rotation[1];
    }

    getRotationZ() {
        return this.rotation[2];
    }

    setRotation(rotationList) {
        this.rotation = rotationList;
        this.updateModel();
    }

    setRotationX(rx) {
        this.rotation[0] = rx;
        this.updateModel();
    }

    setRotationY(ry) {
        this.rotation[1] = ry;
        this.updateModel();
    }

    setRotationZ(rz) {
        this.rotation[2] = rz;
        this.updateModel();
    }

    getScale() {
        return [
            this.scale[0][0],
            this.scale[1][1],
            this.scale[2][2]
        ]
    }

    getScaleX() {
        return this.scale[0][0];
    }

    getScaleY() {
        return this.scale[1][1];
    }

    getScaleZ() {
        return this.scale[2][2];
    }

    setScale(scaleList) {
        this.scale = scaleList;
        this.updateModel();
    }

    setScaleX(sx) {
        this.scale[0][0] = sx;
        this.updateModel();
    }

    setScaleY(sy) {
        this.scale[1][1] = sy;
        this.updateModel();
    }

    setScaleZ(sz) {
        this.scale[2][2] = sz;
        this.updateModel();
    }

    updateModel() {
        this.modelMatrix = multiplyList([
            this.position,
            Projection.rotationZ(this.rotation[2]),
            Projection.rotationY(this.rotation[1]),
            Projection.rotationX(this.rotation[0]),
            this.scale
        ]);
    }
}

export class Light {
    constructor(position = [0,0,0], color = "#ffffff", intensity = 1) {
        this.position = position;
        this.color = color;
        this.intensity = intensity;
    }

    getPosition() {
        return this.position;
    }

    setPosition(position) {
        this.position = position;
    }

    setPositionX(x) {
        this.position[0] = x;
    }

    setPositionY(y) {
        this.position[1] = y;
    }

    setPositionZ(z) {
        this.position[2] = z;
    }

    getColor() {
        return this.color;
    }

    setColor(color) {
        this.color = color;
    }

    getIntensity() {
        return this.intensity;
    }

    setIntensity(intensity) {
        this.intensity = intensity;
    }
}

export async function parseOBJ(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error("OBJ dosyası yüklenemedi");
    const objText = await response.text();

    const lines = objText.split('\n');

    const vertices = [];
    const triangles = [];

    for (let line of lines) {
        line = line.trim();
        if (line.startsWith('v ')) {
            const parts = line.split(/\s+/);
            const x = parseFloat(parts[1]);
            const y = parseFloat(parts[2]);
            const z = parseFloat(parts[3]);
            vertices.push(new Vertex(x, y, z, 1));
        } else if (line.startsWith('f ')) {
            const parts = line.split(/\s+/);
            const idx = parts.slice(1).map(p => parseInt(p.split('/')[0], 10) - 1);
            if (idx.length >= 3) {
                for (let i = 1; i < idx.length - 1; i++) {
                    const v0 = vertices[idx[0]];
                    const v1 = vertices[idx[i]];
                    const v2 = vertices[idx[i + 1]];
                    triangles.push(new Triangle(v0, v1, v2));
                }
            }
        }
    }

    return new Packet(triangles);
}

export class Scene {
    lights = []; 

    constructor({width = window.innerWidth, height = window.innerHeight, parent = document.body} = {}) {
        this.canvas = document.createElement("canvas");
        this.canvas.width = width;
        this.canvas.height = height;
        parent.appendChild(this.canvas);
        this.ctx = this.canvas.getContext("2d");
        
        this.objects = [];
        this.camera = null;
    }
    addLight(light) { this.lights.push(light); }
    addObject(obj) { this.objects.push(obj); }
    setCamera(cam) { this.camera = cam; }
    clear() { this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height); }
}

export class Camera {
    constructor(position=[0,0,0]) {
        this.position = position;
        this.pitch = 0;
        this.yaw = 0;
        this.viewMatrix = [
            [1,0,0,0],
            [0,1,0,0],
            [0,0,1,0],
            [0,0,0,1]
        ];
    }

    getPitch() {
        return this.pitch;
    }

    getYaw() {
        return this.yaw;
    }

    setPitch(p) {
        this.pitch = p;
    }

    setYaw(y) {
        this.yaw = y;
    }

    getPositionX() {
        return this.position[0];
    }

    getPositionY() {
        return this.position[1];
    }

    getPositionZ() {
        return this.position[2];
    }

    getPosition() {
        return this.position;
    } 
    
    getCameraVectors() {
        const pitch = this.pitch * Math.PI / 180;
        const yaw   = this.yaw   * Math.PI / 180;

        const forward = normalize([
            Math.cos(pitch) * Math.sin(yaw),
            Math.sin(pitch),
            -Math.cos(pitch) * Math.cos(yaw)
        ]);

        const right = normalize(
            cross(forward, [0, 1, 0])
        );

        return { forward, right };
    }

    updateView() {
        const pitch = this.pitch * Math.PI/180;
        const yaw = this.yaw * Math.PI/180;

        const fx = Math.cos(pitch)*Math.sin(yaw);
        const fy = Math.sin(pitch);
        const fz = -Math.cos(pitch)*Math.cos(yaw);

        const f = normalize([fx, fy, fz]);
        const r = cross(f, [0,1,0]);
        const u = cross(r, f);

        this.viewMatrix = [
            [r[0], r[1], r[2], -dot(r,this.position)],
            [u[0], u[1], u[2], -dot(u,this.position)],
            [-f[0], -f[1], -f[2], dot(f,this.position)],
            [0,0,0,1]
        ];
    }
}

export class Projection {
    constructor(screen) {
        this.screen = screen;
        const fov = Math.PI/3;
        const aspect = screen.canvas.width/screen.canvas.height;
        const near = 0.1;
        const far = 1000;

        const f = 1/Math.tan(fov/2);

        this.projectionMatrix = [
            [f/aspect, 0, 0, 0],
            [0, f, 0, 0],
            [0, 0, (far+near)/(near-far), (2*far*near)/(near-far)],
            [0, 0, -1, 0]
        ];
    }

    static rotationX(t) {
        t = t*Math.PI/180;
        return [
            [1,0,0,0],
            [0,Math.cos(t),-Math.sin(t),0],
            [0,Math.sin(t),Math.cos(t),0],
            [0,0,0,1]
        ];
    }
    static rotationY(t) {
        t = t*Math.PI/180;
        return [
            [Math.cos(t),0,Math.sin(t),0],
            [0,1,0,0],
            [-Math.sin(t),0,Math.cos(t),0],
            [0,0,0,1]
        ];
    }
    static rotationZ(t) {
        t = t*Math.PI/180;
        return [
            [Math.cos(t),-Math.sin(t),0,0],
            [Math.sin(t),Math.cos(t),0,0],
            [0,0,1,0],
            [0,0,0,1]
        ];
    }

    drawTriangle(p, color = "#c2c2c2") {
        const ctx = this.screen.ctx;
        ctx.beginPath();
        ctx.moveTo(p[0][0], p[0][1]);
        ctx.lineTo(p[1][0], p[1][1]);
        ctx.lineTo(p[2][0], p[2][1]);
        ctx.closePath();    
        
        ctx.fillStyle = color;
        ctx.fill();

        const edgeLength = Math.hypot(p[0][0]-p[1][0], p[0][1]-p[1][1]);
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(0.2, edgeLength * 0.1);
        ctx.stroke();
    }

    render(scene) {
        const ctx = scene.ctx;
        scene.clear();
        scene.camera.updateView();

        const trianglesToDraw = [];

        for (let obj of scene.objects) {
            obj.updateModel(); 

            for (let tri of obj.triangles) {
                const worldV0 = multiplyMatVec(obj.modelMatrix, tri.vertices[0].relative_position);
                const worldV1 = multiplyMatVec(obj.modelMatrix, tri.vertices[1].relative_position);
                const worldV2 = multiplyMatVec(obj.modelMatrix, tri.vertices[2].relative_position);

                const v0View = multiplyMatVec(scene.camera.viewMatrix, worldV0);
                const v1View = multiplyMatVec(scene.camera.viewMatrix, worldV1);
                const v2View = multiplyMatVec(scene.camera.viewMatrix, worldV2);

                if (v0View[2] > -0.1 || v1View[2] > -0.1 || v2View[2] > -0.1) continue;

                const edge1 = [v1View[0] - v0View[0], v1View[1] - v0View[1], v1View[2] - v0View[2]];
                const edge2 = [v2View[0] - v0View[0], v2View[1] - v0View[1], v2View[2] - v0View[2]];
                let normal = normalize(cross(edge1, edge2));

                const viewDir = normalize([v0View[0], v0View[1], v0View[2]]);
                if (dot(normal, viewDir) > 0) continue;

                const viewVertices = [v0View, v1View, v2View];
                const zTri = (v0View[2] + v1View[2] + v2View[2]) / 3;

                trianglesToDraw.push({ tri, viewVertices, zTri, normal });
            }
        }

        trianglesToDraw.sort((a, b) => a.zTri - b.zTri);

        for (let item of trianglesToDraw) {
            const pts = [];
            for (let v of item.viewVertices) {
                const p = multiplyMatVec(this.projectionMatrix, v);
                const ndc = [p[0] / p[3], p[1] / p[3], p[2] / p[3]];
                pts.push([
                    (ndc[0] + 1) * 0.5 * scene.canvas.width,
                    (1 - ndc[1]) * 0.5 * scene.canvas.height
                ]);
            }

            let finalColor = item.tri.color;
            for (let light of scene.lights) {
                const lightDir = normalize([
                    light.position[0] - item.viewVertices[0][0],
                    light.position[1] - item.viewVertices[0][1],
                    light.position[2] - item.viewVertices[0][2]
                ]);

                const intensity = Math.max(0.1, dot(lightDir, item.normal));
                finalColor = multiplyHexColor(item.tri.color, light.color, intensity);
            }

            this.drawTriangle(pts, finalColor);
        }
    }
}

export class Movement {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;

        this.enable = false;

        this.speed = 0.3;
        this.sensitivity = 0.15;
        this.maxPitch = 89;

        this.keys = {};

        this._bindEvents();
    }

    _bindEvents() {
        window.addEventListener('keydown', e => {
            if (!this.enable) return;
            this.keys[e.key.toLowerCase()] = true;
        });

        window.addEventListener('keyup', e => {
            if (!this.enable) return;
            this.keys[e.key.toLowerCase()] = false;
        });

        this.scene.canvas.addEventListener('click', () => {
            if (!this.enable) return;
            this.scene.canvas.requestPointerLock();
        });

        window.addEventListener('mousemove', e => {
            if (!this.enable) return;
            if (document.pointerLockElement !== this.scene.canvas) return;

            this.camera.yaw   += e.movementX * this.sensitivity;
            this.camera.pitch -= e.movementY * this.sensitivity;

            this.camera.pitch = Math.max(
                -this.maxPitch,
                Math.min(this.maxPitch, this.camera.pitch)
            );
        });
    }

    update() {
        if (!this.enable) return;

        const pitch = this.camera.pitch * Math.PI / 180;
        const yaw   = this.camera.yaw   * Math.PI / 180;

        const forward = [
            Math.cos(pitch) * Math.sin(yaw),
            Math.sin(pitch),
            -Math.cos(pitch) * Math.cos(yaw)
        ];

        const len = Math.hypot(...forward);
        forward[0] /= len;
        forward[1] /= len;
        forward[2] /= len;

        const right = [
            forward[2],
            0,
            -forward[0]
        ];

        if (this.keys['w']) {
            this.camera.position[0] += forward[0] * this.speed;
            this.camera.position[1] += forward[1] * this.speed;
            this.camera.position[2] += forward[2] * this.speed;
        }
        if (this.keys['s']) {
            this.camera.position[0] -= forward[0] * this.speed;
            this.camera.position[1] -= forward[1] * this.speed;
            this.camera.position[2] -= forward[2] * this.speed;
        }
        if (this.keys['d']) {
            this.camera.position[0] -= right[0] * this.speed;
            this.camera.position[2] -= right[2] * this.speed;
        }
        if (this.keys['a']) {
            this.camera.position[0] += right[0] * this.speed;
            this.camera.position[2] += right[2] * this.speed;
        }
    }
}

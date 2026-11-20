"""Generate the editable Chen ER overview for ParkSmart."""
from pathlib import Path
from xml.etree.ElementTree import Element, SubElement, ElementTree

OUT = Path(__file__).resolve().parents[1] / "docs" / "parksmart-er-diagram.drawio"

def add_page(root, page_id, name, width, height):
    diagram = SubElement(root, "diagram", {"id": page_id, "name": name})
    model = SubElement(diagram, "mxGraphModel", {"dx": str(width), "dy": str(height), "grid": "1", "gridSize": "10", "guides": "1", "tooltips": "1", "connect": "1", "arrows": "1", "fold": "1", "page": "1", "pageScale": "1", "pageWidth": str(width), "pageHeight": str(height), "math": "0", "shadow": "0"})
    root_cell = SubElement(model, "root")
    SubElement(root_cell, "mxCell", {"id": "0"})
    SubElement(root_cell, "mxCell", {"id": "1", "parent": "0"})
    return root_cell

def vertex(parent, cell_id, label, x, y, w, h, shape, style=""):
    base = {"ellipse": "ellipse", "diamond": "rhombus", "entity": "rectangle", "text": "text"}[shape]
    color = "fillColor=#fff2cc;strokeColor=#d6b656;" if shape == "diamond" else "fillColor=#ffffff;strokeColor=#1f4e79;" if shape == "entity" else "fillColor=#ffffff;strokeColor=#555555;" if shape == "ellipse" else "fillColor=none;strokeColor=none;"
    if shape == "entity": color += "fontStyle=1;"
    SubElement(parent, "mxCell", {"id": cell_id, "value": label, "style": f"{base};whiteSpace=wrap;html=1;align=center;verticalAlign=middle;{color}{style}", "vertex": "1", "parent": "1"})
    SubElement(parent[-1], "mxGeometry", {"x": str(x), "y": str(y), "width": str(w), "height": str(h), "as": "geometry"})

def edge(parent, cell_id, source, target, style=""):
    SubElement(parent, "mxCell", {"id": cell_id, "value": "", "style": f"edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;endArrow=none;startArrow=none;strokeColor=#475569;{style}", "edge": "1", "parent": "1", "source": source, "target": target})
    SubElement(parent[-1], "mxGeometry", {"relative": "1", "as": "geometry"})

def relation(parent, name, x, y, a, b, cardinality_a, cardinality_b, rel_id):
    vertex(parent, rel_id, name, x, y, 180, 86, "diamond")
    edge(parent, rel_id + "_a", a, rel_id)
    edge(parent, rel_id + "_b", rel_id, b)
    vertex(parent, rel_id + "_ca", cardinality_a, x - 26, y + 20, 28, 28, "text", "fontStyle=1;fontColor=#b42318;")
    vertex(parent, rel_id + "_cb", cardinality_b, x + 178, y + 42, 28, 28, "text", "fontStyle=1;fontColor=#b42318;")

def main():
    mxfile = Element("mxfile", {"host": "app.diagrams.net", "modified": "2026-11-19T00:00:00.000Z", "agent": "Codex", "version": "24.7.17", "type": "device"})
    page = add_page(mxfile, "parksmart-er", "Chen ER overview", 6200, 2200)
    # Title and legend
    vertex(page, "title", "ParkSmart - Integrated Chen ER Model", 80, 35, 1100, 60, "text", "fontSize=26;fontStyle=1;fontColor=#16324f;align=left;")
    vertex(page, "legend", "Rectangle = entity set   Diamond = relationship set   Oval = key attribute (underlined)   Red 1/N labels = Chen cardinality", 80, 100, 1500, 45, "text", "fontSize=15;fontColor=#475569;align=left;")
    entities = {
        "AREAS": (220, 360, "area_id"), "USERS": (1320, 360, "user_id"),
        "PARKING_LOTS": (2520, 360, "lot_id"), "LOT_PROFILE\n(MongoDB)": (4100, 360, "_id"),
        "VEHICLES": (620, 1330, "vehicle_id"), "REVIEWS": (1520, 1840, "review_id"),
        "SLOTS": (2440, 1330, "slot_id"), "BOOKINGS": (3540, 1330, "booking_id"),
        "PAYMENTS": (4840, 1050, "payment_id"), "BOOKING_AUDIT_LOG": (4840, 1750, "log_id"),
    }
    ids = {}
    for i, (name, (x, y, key)) in enumerate(entities.items()):
        ident = f"e{i}"
        ids[name] = ident
        vertex(page, ident, name.replace("\n", "<br>"), x, y, 300, 92, "entity", "fontSize=17;")
        vertex(page, ident + "_pk", f"<u>{key}</u>", x + 56, y + 112, 190, 56, "ellipse", "fontSize=14;")
        edge(page, ident + "_pk_edge", ident, ident + "_pk")
    relations = [
        ("OWNS_VEHICLE", 950, 850, "USERS", "VEHICLES", "1", "N"),
        ("OWNS_LOT", 2030, 310, "USERS", "PARKING_LOTS", "1", "N"),
        ("ASSIGNED_TO", 2010, 600, "USERS", "PARKING_LOTS", "M", "N"),
        ("LOCATES", 1510, 150, "AREAS", "PARKING_LOTS", "1", "N"),
        ("HAS_PROFILE", 3470, 220, "PARKING_LOTS", "LOT_PROFILE\n(MongoDB)", "1", "1"),
        ("CONTAINS", 2750, 850, "PARKING_LOTS", "SLOTS", "1", "N"),
        ("MAKES", 2730, 600, "USERS", "BOOKINGS", "1", "N"),
        ("USES", 2320, 1370, "VEHICLES", "BOOKINGS", "1", "N"),
        ("RESERVES", 3100, 1330, "SLOTS", "BOOKINGS", "1", "N"),
        ("HAS_PAYMENT", 4220, 1030, "BOOKINGS", "PAYMENTS", "1", "0..1"),
        ("HAS_HISTORY", 4230, 1680, "BOOKINGS", "BOOKING_AUDIT_LOG", "1", "N"),
        ("WRITES", 1530, 1300, "USERS", "REVIEWS", "1", "N"),
        ("ABOUT", 2360, 1760, "PARKING_LOTS", "REVIEWS", "1", "N"),
    ]
    for i, (name, x, y, a, b, ca, cb) in enumerate(relations):
        relation(page, name, x, y, ids[a], ids[b], ca, cb, f"r{i}")
    # Recursive area hierarchy; roles disambiguate parent and child.
    vertex(page, "parent_of", "PARENT_OF", 90, 670, 180, 90, "diamond")
    edge(page, "area_parent_a", ids["AREAS"], "parent_of")
    edge(page, "area_parent_b", "parent_of", ids["AREAS"], "exitX=0.5;exitY=1;entryX=0;entryY=0.5;")
    vertex(page, "parent_role", "Parent 1 / Child N", 70, 790, 240, 42, "text", "fontColor=#b42318;fontStyle=1;")
    # Relationship attribute for the associative relationship.
    vertex(page, "assigned_at", "assigned_at", 1990, 730, 230, 60, "ellipse", "fontSize=14;")
    edge(page, "assigned_at_edge", "r2", "assigned_at")
    vertex(page, "crossdb_note", "Cross-database association: PARKING_LOTS.mongo_lot_id = LOT_PROFILE._id; LOT_PROFILE.pg_lot_id is uniquely indexed. No cross-database FK is enforced.", 3000, 30, 2700, 90, "text", "fontSize=15;fontColor=#7c2d12;whiteSpace=wrap;align=left;")
    vertex(page, "map_note", "LOT_STAFF is the relational mapping of ASSIGNED_TO. BOOKINGS.(vehicle_id,user_id) references the same user's VEHICLES row.", 500, 2050, 4200, 50, "text", "fontSize=15;fontColor=#475569;align=left;")
    # Chen attribute sheet: every entity's non-relational key/descriptive
    # attributes are represented with ovals, while FK columns are represented
    # by the relationship diamonds on the overview page.
    attrs = [
        ("AREAS", ["area_id", "name", "level"]),
        ("USERS", ["user_id", "name", "email", "phone", "password_hash", "role", "created_at"]),
        ("VEHICLES", ["vehicle_id", "reg_number", "vehicle_type"]),
        ("PARKING_LOTS", ["lot_id", "name", "mongo_lot_id", "base_rate_per_hr", "is_active", "created_at"]),
        ("SLOTS", ["slot_id", "slot_label", "slot_type", "status"]),
        ("BOOKINGS", ["booking_id", "booking_code", "start_time", "end_time", "status", "amount", "expires_at", "created_at", "checked_in_at", "checked_out_at"]),
        ("PAYMENTS", ["payment_id", "amount", "method", "status", "paid_at", "created_at"]),
        ("REVIEWS", ["review_id", "rating", "comment", "created_at"]),
        ("BOOKING_AUDIT_LOG", ["log_id", "old_status", "new_status", "changed_by", "changed_at"]),
        ("LOT_PROFILE (MongoDB)", ["_id", "pg_lot_id", "name", "description", "location", "address", "amenities", "vehicle_types_allowed", "height_limit_m", "operating_hours", "photos", "pricing_rules", "updated_at"]),
    ]
    attr_page = add_page(mxfile, "parksmart-attributes", "Chen attributes", 6600, 3000)
    vertex(attr_page, "attr_title", "ParkSmart - Entity Attributes (Chen Notation)", 80, 35, 1400, 60, "text", "fontSize=26;fontStyle=1;fontColor=#16324f;align=left;")
    vertex(attr_page, "attr_legend", "Each entity is a rectangle; each attribute is an oval. Underlined ovals are the selected primary-key attributes. Relationship/FK attributes are shown as relationships in the overview and in the mapped schema.", 80, 100, 5000, 50, "text", "fontSize=15;fontColor=#475569;align=left;")
    for i, (entity, fields) in enumerate(attrs):
        col, row = i % 5, i // 5
        bx, by = 80 + col * 1300, 230 + row * 1320
        e_id = f"attr_entity_{i}"
        vertex(attr_page, e_id, entity.replace(" (", "<br>("), bx + 250, by, 560, 82, "entity", "fontSize=17;")
        mid = (len(fields) + 1) // 2
        for j, field in enumerate(fields):
            side, idx = (0, j) if j < mid else (1, j - mid)
            ax, ay = bx + 10 + side * 650, by + 150 + idx * 145
            attr_id = f"attr_{i}_{j}"
            label = f"<u>{field}</u>" if j == 0 else field
            if entity == "LOT_PROFILE (MongoDB)" and field in {"amenities", "vehicle_types_allowed", "photos", "pricing_rules"}:
                vertex(attr_page, attr_id, "", ax, ay, 500, 76, "ellipse", "fontSize=14;")
                vertex(attr_page, attr_id + "_inner", label, ax + 8, ay + 7, 484, 62, "ellipse", "fontSize=13;")
            else:
                vertex(attr_page, attr_id, label, ax, ay, 500, 76, "ellipse", "fontSize=14;")
            edge(attr_page, f"attr_edge_{i}_{j}", e_id, attr_id)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    ElementTree(mxfile).write(OUT, encoding="utf-8", xml_declaration=True)

if __name__ == "__main__":
    main()

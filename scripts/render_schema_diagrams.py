from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / 'docs'
FONT = Path('C:/Windows/Fonts/arial.ttf')
FONT_BOLD = Path('C:/Windows/Fonts/arialbd.ttf')
def font(size, bold=False): return ImageFont.truetype(str(FONT_BOLD if bold else FONT), size)

tables = {
 'AREAS':['PK area_id','name','level','FK parent_area_id'],
 'USERS':['PK user_id','name','UQ email','UQ phone','password_hash','role'],
 'VEHICLES':['PK vehicle_id','FK user_id','UQ reg_number','vehicle_type','UQ (vehicle_id,user_id)'],
 'PARKING_LOTS':['PK lot_id','FK owner_id','FK area_id','UQ mongo_lot_id','base_rate_per_hr','is_active'],
 'LOT_STAFF':['PK/FK lot_id','PK/FK user_id','assigned_at'],
 'SLOTS':['PK slot_id','FK lot_id','slot_label','slot_type','status','UQ (lot_id,slot_label)'],
 'BOOKINGS':['PK booking_id','UQ booking_code','FK user_id','FK (vehicle_id,user_id)','FK slot_id','start_time, end_time','status, amount, expires_at'],
 'PAYMENTS':['PK payment_id','UQ/FK booking_id','amount','method','status','paid_at'],
 'REVIEWS':['PK review_id','FK user_id','FK lot_id','rating','comment','UQ (user_id,lot_id)'],
 'BOOKING_AUDIT_LOG':['PK log_id','FK booking_id (RESTRICT)','old_status, new_status','changed_by','changed_at'],
}
edges=[('AREAS','AREAS','parent'),('AREAS','PARKING_LOTS','area'),('USERS','VEHICLES','owns'),('USERS','PARKING_LOTS','owns'),('USERS','LOT_STAFF','staff'),('PARKING_LOTS','LOT_STAFF','assignments'),('PARKING_LOTS','SLOTS','contains'),('USERS','BOOKINGS','books'),('VEHICLES','BOOKINGS','vehicle'),('SLOTS','BOOKINGS','reserved'),('BOOKINGS','PAYMENTS','payment'),('USERS','REVIEWS','writes'),('PARKING_LOTS','REVIEWS','receives'),('BOOKINGS','BOOKING_AUDIT_LOG','audit')]
layout={'AREAS':(0,0),'USERS':(1,0),'VEHICLES':(2,0),'PARKING_LOTS':(3,0),'LOT_STAFF':(4,0),'SLOTS':(0,1),'BOOKINGS':(1,1),'PAYMENTS':(2,1),'REVIEWS':(3,1),'BOOKING_AUDIT_LOG':(4,1)}
def render(filename, detailed):
    w,h=2600,1420 if not detailed else 1650
    im=Image.new('RGB',(w,h),'#f5f8fc');d=ImageDraw.Draw(im)
    d.text((70,38),'ParkSmart · Relational Model' if detailed else 'ParkSmart · Entity Relationship Diagram',font=font(46,True),fill='#13243a')
    d.text((72,96),'PostgreSQL entities, keys and relationships' if detailed else 'Primary and foreign key relationships; MongoDB lot_profiles links by mongo_lot_id',font=font(24),fill='#52647a')
    ox,oy,bw,bh,gx,gy=60,200,475,470 if detailed else 410,35,95
    centers={}
    # Edges behind entities.
    for name,fields in tables.items():
        x,y=layout[name];x=ox+x*(bw+gx);y=oy+y*(bh+gy)
        d.rounded_rectangle((x,y,x+bw,y+bh),radius=18,fill='white',outline='#a9bbcf',width=3)
        d.rounded_rectangle((x,y,x+bw,y+62),radius=18,fill='#174c7a')
        d.rectangle((x,y+40,x+bw,y+62),fill='#174c7a')
        d.text((x+18,y+13),name,font=font(25,True),fill='white')
        fs=21 if detailed else 24; yy=y+82
        for fld in fields:
            d.text((x+20,yy),fld,font=font(fs),fill='#26384d');yy+=34
        if name=='BOOKINGS':
            d.text((x+20,min(y+bh-45,yy+5)),'EXCLUDE: slot_id + [start,end)',font=font(17,True),fill='#a33b37')
    d.text((70,h-110),'Relationships: areas contain areas and locate lots; users own vehicles/lots, staff assignments, bookings and reviews.',font=font(18),fill='#52647a')
    d.text((70,h-78),'Lots contain slots and staff assignments; slots are reserved by bookings; bookings link to payments and audit history.',font=font(18),fill='#52647a')
    d.text((70,h-46),'Time intervals use half-open [start_time, end_time); active overlaps are excluded by GiST.',font=font(18),fill='#52647a')
    im.save(OUT/filename,optimize=True)
render('er-diagram.png',False)
render('relational-schema.png',True)

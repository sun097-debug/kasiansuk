import sys
from PIL import Image, ImageDraw, ImageFilter
def icon(size, path, bg, shadow=True, cover='#CFE9DC', spine='#B2DCC7', sun='#FFC9AE', leafc='#8FCFB1'):
    S = 4*size
    im = Image.new('RGB', (S, S), bg)
    k = S*0.78/44; ox = (S-42*k)/2; oy = (S-44*k)/2
    P = lambda x,y: (ox+x*k, oy+y*k)
    if shadow:  # เงานุ่มใต้สมุด ให้สมุดลอยเด่นจากพื้น
        sh = Image.new('RGBA', (S, S), (0,0,0,0))
        ImageDraw.Draw(sh).rounded_rectangle([P(6,5.5), P(34,41.5)], radius=6*k, fill=(46,90,120,70))
        sh = sh.filter(ImageFilter.GaussianBlur(S*0.02))
        im.paste(sh, (0,0), sh)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([P(6,4), P(34,40)], radius=6*k, fill=cover)
    d.rectangle([P(10,4), P(13,40)], fill=spine)
    d.ellipse([P(18,12), P(30,24)], fill=sun)
    leaf = Image.new('RGBA', (int(14*k), int(7*k)), (0,0,0,0))
    ImageDraw.Draw(leaf).ellipse([0,0,leaf.width-1,leaf.height-1], fill=leafc)
    leaf = leaf.rotate(20, expand=True, resample=Image.BICUBIC)
    cx, cy = P(22,31)
    im.paste(leaf, (int(cx-leaf.width/2), int(cy-leaf.height/2)), leaf)
    im.resize((size,size), Image.LANCZOS).save(path)
if __name__ == '__main__':
    mode = sys.argv[1]
    if mode == 'dark':
        from PIL import Image
        icon(240,'/tmp/d0.png','#CCE7F8'); icon(240,'/tmp/d1.png','#CCE7F8',cover='#B9DFCD',spine='#97CBB3',sun='#FFC3A6',leafc='#76BF9C'); icon(240,'/tmp/d2.png','#CCE7F8',cover='#A9D6C0',spine='#86C3A7',sun='#FFBC9C',leafc='#62B48C')
        W=Image.new('RGB',(810,260),'white')
        for i in range(3):
            t=Image.open(f'/tmp/d{i}.png'); m=Image.new('L',t.size,0); ImageDraw.Draw(m).rounded_rectangle([0,0,239,239],radius=54,fill=255); W.paste(t,(i*270+15,10),m)
        W.save('/tmp/icon-dark.png'); sys.exit()
    if mode == 'cands':
        tiles = []
        for bg in ['#BFE0F5', '#CCE7F8', '#D6ECFA']:
            icon(240, f'/tmp/c-{bg[1:]}.png', bg)
            tiles.append(Image.open(f'/tmp/c-{bg[1:]}.png'))
        icon(240, '/tmp/c-old.png', '#BFE0F5', shadow=False); tiles.insert(0, Image.open('/tmp/c-old.png'))
        W = Image.new('RGB', (len(tiles)*270, 260), 'white')
        for i, t in enumerate(tiles):
            m = Image.new('L', t.size, 0); ImageDraw.Draw(m).rounded_rectangle([0,0,239,239], radius=54, fill=255)
            W.paste(t, (i*270+15, 10), m)
        W.save('/tmp/icon-cands.png')
    else:
        bg, out = sys.argv[2], sys.argv[3]
        kw = dict(cover='#B9DFCD', spine='#97CBB3', sun='#FFC3A6', leafc='#76BF9C')
        icon(180, out+'/apple-touch-icon.png', bg, **kw); icon(192, out+'/icon-192.png', bg, **kw); icon(512, out+'/icon-512.png', bg, **kw)

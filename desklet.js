const Gio = imports.gi.Gio;
const St = imports.gi.St;

const Desklet = imports.ui.desklet;

const Lang = imports.lang;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;
const Util = imports.misc.util;

const Soup = imports.gi.Soup;
const Cinnamon = imports.gi.Cinnamon;
const PopupMenu = imports.ui.popupMenu;

const UUID = "dovizKuru@zafer";
const DESKLET_DIR = imports.ui.deskletManager.deskletMeta[UUID].path;
imports.searchPath.push(DESKLET_DIR);
const xml = imports.marknote;

let session = new Soup.SessionAsync();
Soup.Session.prototype.add_feature.call(session, new Soup.ProxyResolverDefault());

function MyDesklet(metadata, deskletId){
    this._init(metadata, deskletId);
}

MyDesklet.prototype = {
    __proto__: Desklet.Desklet.prototype,

    _init: function(metadata){
        Desklet.Desklet.prototype._init.call(this, metadata);


        this.dovizPanel = new St.BoxLayout({vertical:true, x_align:2, y_align:2});
        this.dovizPanel.style = "padding: 8px;";

        // Görsel Elemanları Ekle
        this.baslik = new St.Label();
        this.baslik.set_text(_("Döviz Kurları"));
        this.baslik.style = "font-size: 14pt;text-align: center;text-decoration: underline;";

        let tarih = new Date();
        this.sonGuncelleme = new St.Label({margin_top: 5});
        this.sonGuncelleme.set_text("Son Güncelleme: " + tarih.toLocaleFormat("%T"));
        this.sonGuncelleme.style = "font-style: italic; font-size: 9px; text-align: center;";

        this.dovizPanel.add(this.baslik);
        this.dovizPanel.add(this.dolarKuru("0"));
        this.dovizPanel.add(this.euroKuru("0"));
        this.dovizPanel.add(this.sonGuncelleme);







        this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
			
        this._menu.addAction(_("Güncelle"), Lang.bind(this, function() {
            this.veriYukle();
            this.refresh();
        }));

        // Etiketler

        this.veriYukle();

        this.setHeader(_("Döviz Kurları"));
        this.setContent(this.dovizPanel);

        //this.xmlParse();

       // this.dosya = GLib.get_home_dir() + "/.local/share/cinnamon/desklets/dovizKuru@zafer/test.d";
       // Util.spawnCommandLine("rdmd " + this.dosya);
    },
    
    on_desklet_removed: function() {
	    Mainloop.source_remove(this.timeout);
    },

    veriYukle : function() {
        this.xmlDosyaIndir();
        
        let orjDosyaAdresi = GLib.get_home_dir() + "/.local/share/cinnamon/desklets/dovizKuru@zafer/kurlar.xml";
        let dosyaAdresi = GLib.get_home_dir() + "/.local/share/cinnamon/desklets/dovizKuru@zafer/kurlar-yeni.xml";

        GLib.spawn_command_line_sync("iconv -f latin1 -t utf-8 "+ orjDosyaAdresi +" -o " + dosyaAdresi);

        let xmlVeri = Cinnamon.get_file_contents_utf8_sync(dosyaAdresi);
        
        let parser = new marknote.Parser();
        let doc = parser.parse(xmlVeri);

        try 
        {
            //let rootElem = doc.getRootElement();
            //let isim = rootElem.getChildElement("Currency").getChildElement("Isim").getText();
            //let satis = rootElem.getChildElement("Currency").getChildElement("ForexSelling").getText();

            let dolarKur = "-1";
            let euroKur = "-1";

            let rootElem = doc.getRootElement();
            let currencyList = rootElem.getChildElements("Currency");

            for (let i=0; i < currencyList.length; i++)
            {
                let dovizKodu = currencyList[i].getAttributeValue("Kod");
                
                if (dovizKodu == "USD")
                {
                    dolarKur = currencyList[i].getChildElement("ForexSelling").getText();
                }
                else if (dovizKodu == "EUR")
                {
                    euroKur = currencyList[i].getChildElement("ForexSelling").getText();
                }
            }

            let tarih = new Date();
            this.dolarVeri.set_text(dolarKur);
            this.euroVeri.set_text(euroKur);
            this.sonGuncelleme.set_text("Son Güncelleme: " + tarih.toLocaleFormat("%T"));

            this.timeout = Mainloop.timeout_add_seconds(60, Lang.bind(this, this.veriYukle));
        }
        catch(e)
        {
            global.logError(e);
        }
    },

    dolarKuru : function(kur) {
        this.dovizKutu = new St.BoxLayout({vertical:false});
        this.dolarEtiket = new St.Label();
        this.dolarEtiket.set_text("Dolar : ");
        
        this.dolarVeri = new St.Label();
        this.dolarVeri.set_text(kur);
       
        this.dovizKutu.add(this.dolarEtiket);
        this.dovizKutu.add(this.dolarVeri);

        return this.dovizKutu;
    },

    euroKuru : function(kur) {
        this.dovizKutu = new St.BoxLayout({vertical:false});
        this.euroEtiket = new St.Label();
        this.euroEtiket.set_text("Euro : ");
        
        this.euroVeri = new St.Label();
        this.euroVeri.set_text(kur);
       
        this.dovizKutu.add(this.euroEtiket);
        this.dovizKutu.add(this.euroVeri);

        return this.dovizKutu;
    },

    xmlDosyaIndir : function()
    {
        var dosya = GLib.get_home_dir() + "/.local/share/cinnamon/desklets/dovizKuru@zafer/kurlar.xml";
        let xmldosya = Gio.file_new_for_path(dosya);
        var outStream = new Gio.DataOutputStream({base_stream:xmldosya.replace(null, false, Gio.FileCreateFlags.NONE, null)});
        var url = "http://www.tcmb.gov.tr/kurlar/today.xml";

		global.log("Downloading " + url);
		
        var message = Soup.Message.new('GET', url);
		session.queue_message(message, function(session, response) {
			if (response.status_code !== Soup.KnownStatusCode.OK) {
			   global.logError("Error during download: response code " + response.status_code
				  + ": " + response.reason_phrase + " - " + response.response_body.data);
			   callback(false, null);
			   return true;
			}

			try {
				Cinnamon.write_soup_message_to_stream(outStream, message);
				outStream.close(null);
			}
			catch (e) {
			   global.logError("Site seems to be down. Error was:");
			   global.logError(e);
			   callback(false, null);
			   return true;
			}

			// global.log("Save to " + localFilename);
			callback(true, localFilename);
			return false;
		 });
    },
}

function main(metadata, desklet_id){
    let desklet = new MyDesklet(metadata, desklet_id);
    return desklet;
}

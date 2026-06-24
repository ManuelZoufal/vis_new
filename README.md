# System- & Architektur-Dokumentation
## Projekt: Sensor-Visualisierungs- & Integrationssystem (VIS)

Dieses Dokument bietet eine umfassende technische und funktionelle Beschreibung des Sensor-Visualisierungs- und Integrationssystems (VIS). Es dient als vollständiges Übergabedokument für die Fertigstellung, Wartung und Weiterentwicklung der Anwendung.

---

## 1. Funktionelle Systemübersicht

Das System dient der automatisierten Erfassung, Aggregation und Echtzeit-Überwachung von Personenzähl- und Belegungsdaten in Gebäuden oder Teilbereichen. Es schließt die Lücke zwischen lokaler IoT-Sensor-Hardware und übergeordneten Cloud-Plattformen.

### Kernfunktionen:
* **Zyklische Multi-Protokoll-Datenerfassung:** Das System fragt autonom und parallel vordefinierte Hardware-Sensoren über deren IP-Schnittstellen ab.
* **Hierarchische logische Gruppierung:** Einzelne Sensoren werden logischen Gruppen (z. B. Gastronomiezonen wie "Trattoria Giorgio" oder "Restaurant Geschmackswerk") zugeordnet, um aggregierte Belegungszustände für ganze Zonen zu berechnen.
* **Kapazitätsüberwachung & Schwellenwerte:** Für jede Gruppe ist eine maximale Kapazität (`max_occupancy`) definiert. Das System überwacht diese Grenzwerte kontinuierlich, um Überbelegungen zu verhindern.
* **Upstream-Synchronisation (Navigator):** Gesammelte Belegungsdaten werden in standardisierte Datenpunkte übersetzt und zyklisch an ein externes übergeordnetes Gebäudemanagementsystem („Navigator“) übertragen.
* **Automatisierte Wartung (Job-Scheduler):** Da Hardware-Zähler im Dauerbetrieb driften können, besitzt das System eine eingebaute Zeitschaltuhr, um Zählerstände zurückzusetzen (`reset`) oder Geräte neu zu starten (`reboot`).
* **Web-Dashboard & Administration:** Eine Flask-basierte Weboberfläche ermöglicht es Administratoren, Benutzer zu verwalten, Sensoren zu konfigurieren, Logs einzusehen und Live-Visualisierungen zu betrachten.

---

## 2. Technische Systemarchitektur

Die Anwendung ist als modulare Python-Anwendung auf Basis des **Flask**-Frameworks aufgebaut. Sie setzt stark auf **Multithreading**, um die Netzwerkkonstrukte mit den Sensoren und Hintergrunddienste parallel und blockierungsfrei auszuführen.

### 2.1 Verzeichnis- und Komponentenstruktur
* `app.py`: Zentraler Einstiegspunkt der Anwendung. Initialisiert die Datenbank, startet sämtliche Hintergrund-Threads und den HTTPS-Webserver.
* `config.json`: Zentrale Konfigurationsdatei für Sensoren, Gruppen-Grenzwerte und Zeitpläne (Schedules).
* `change_log.txt`: System- und Audit-Logdatei für automatische Aktionen (z. B. Sensor-Resets).
* `Webserver_IP.crt` & `Webserver_IP.pem`: Lokale TLS/SSL-Zertifikate für die HTTPS-Verschlüsselung.
* `routes/`: Modulare Flask-Blueprints zur Trennung der Webseitenbereiche und Endpunkte:
  * `root_bp` (`/`): Landingpage, Login-Verarbeitung und Standard-Routen.
  * `group_bp` (`/groups`): Routen für Gruppen-Ansichten und spezifische Einstellungen.
  * `visualize_bp` (`/visualize`): Konfiguration und Anzeige von Live-Visualisierungen.
  * `api_bp` (`/api`): REST-Schnittstellen für AJAX-Requests des Frontends.
  * `admin_bp` (`/admin`): Benutzerverwaltung, Passwörter und administrative Einstellungen.
* `src/`: Core-Logikkomponenten und Backend-Treiber:
  * `database.py`: SQLite-Abstraktion, Initialisierung und persistenter Datenbank-Thread.
  * `sensor.py`: Factory-Muster zum Laden und Verwalten von Sensoren aus der Konfiguration.
  * `scheduler.py`: CRON-ähnliche Engine zur Ausführung geplanter Tasks.
  * `navigator.py`: API-Client für den externen Daten-Upload.
  * `helpers.py`: Hilfsfunktionen wie z. B. Authentifizierungs-Dekoratoren (`@login_required`).

---

## 3. Hintergrund-Prozesse & Threading Engine

Beim Start der Anwendung in `app.py` werden kritische Prozesse in separate, langlebige Hintergrundthreads ausgelagert. Tritt in einem Thread eine ungefangene Exception auf, fängt die Funktion `monitor_thread` diese ab und protokolliert sie in der globalen Liste `thread_statuses`, um einen Gesamtabsturz zu verhindern.

### Die 4 Säulen der Thread-Engine:

#### 1. SensorThreads (1 Thread pro Sensor)
* **Intervall:** Alle 7 Sekunden (`sensor_interval = 7`).
* **Aufgabe:** Abfrage der aktuellen Zählerwerte (In / Out / Occupancy) direkt von der IP-Adresse des jeweiligen Sensors unter Verwendung der hinterlegten Zugangsdaten.

#### 2. DBOutputThread (1 globaler Thread)
* **Intervall:** Alle 30 Sekunden (`db_output_interval = 30`).
* **Aufgabe:** Schreibt die aktuellen Belegungsdaten und den Systemstatus konsistent in die SQLite-Datenbank (`sensor_data.db`).

#### 3. NavigatorUploadThread (1 globaler Thread)
* **Intervall:** Alle 60 Sekunden (`navigator_interval = 60`).
* **Aufgabe:** Übermittelt die aktuellen Belegungswerte unter Angabe der spezifischen Datenpunkt-IDs (`datapoint_id`) an die Navigator-Schnittstelle. Beim Systemstart wird zudem ein initialer Push für jeden Sensor durchgeführt.

#### 4. SchedulerThread (1 globaler Thread)
* **Aufgabe:** Überwacht die in der `config.json` definierten Zeitpläne (Schedules). Gleicht die Systemzeit mit den Vorgaben ab und triggert geplante Aktionen (`reset` oder `reboot`) für die betroffenen Sensor-IDs.

---

## 4. Datenmodell & Konfiguration (`config.json`)

Die Steuerung des Systems erfolgt vollständig deklarativ über die `config.json`. Sie unterteilt sich in drei Hauptbereiche:

### 4.1 Sensors (Hardware-Mapping)
Das System unterstützt out-of-the-box zwei Hardware-Hersteller, welche über das Feld `"type"` dynamisch gemappt werden:
* `"AI_HANWHA"`: Verwendet HTTP/HTTPS-Schnittstellen der Hanwha-KI-Kameras. Benötigt `username` und `password`.
* `"IEE"`: Nutzt das native Protokoll von IEE-People-Countern. Erfordert ein Passwort/Token, aber keinen separaten Benutzernamen.

### 4.2 Groups (Zonen-Abstraktion)
Definiert die betrieblichen Kapazitätsgrenzen und Texte. Über das Feld `"maintenance_mode"` (true/false) können Zonen in den Wartungsmodus versetzt werden, wodurch Berechnungen eingefroren oder Warnungen im Frontend unterdrückt werden (z. B. für die *Default Group* aktiv).

### 4.3 Schedules (Automatisierungs-Logik)
Schedules steuern die zyklische Systemwartung:
* **Global (Schedules 1-3):** Betrifft alle Sensoren (1–12). Montags um 00:15 Uhr erfolgt ein Hard-Reboot der Hardware. Um 07:00 Uhr und 23:45 Uhr werden alle Zähler genullt.
* **Granular (Schedules 4-6):** Ermöglicht gezielte Ausnahmen. Sensor 8 und Sensor 10 erhalten beispielsweise um 23:00 Uhr einen vorgezogenen Reset.

---

## 5. Security & Netzwerkkonfiguration

* **Erzwungenes HTTPS (Transportsicherheit):** Über den Flask-Hook `@app.before_request` wird jede unverschlüsselte HTTP-Anfrage automatisch mit einem permanenten Redirect (HTTP 301) auf HTTPS umgeleitet.
* **Kryptographischer Session-Schutz:** Sitzungsdaten werden serverseitig verschlüsselt. Das System nutzt hierfür den `APP_SECRET_KEY` aus den Umgebungsvariablen.
* **Session-Lifetime:** Sessions sind permanent geschaltet (`session.permanent = True`), verfallen jedoch strikt nach Ablauf der in `SESSION_LIFETIME_HOURS` definierten Stunden (Standard: 24h). Bei jedem Request wird der Zeitstempel aktualisiert.
* **SSL-Zertifikate:** Der integrierte Flask-Server startet nativ im SSL-Kontext unter Verwendung der lokalen Zertifikatsdateien `Webserver_IP.crt` (Zertifikat) und `Webserver_IP.pem` (Private Key).
* **SSL-Zertifikatsprüfung umgehen:** Da lokale IoT-Geräte im LAN selten über offiziell signierte Zertifikate verfügen, wird die Warnung für unsichere HTTPS-Anfragen (`InsecureRequestWarning`) global über `urllib3` deaktiviert, um den Datenfluss nicht zu blockieren.
"# vis_new" 

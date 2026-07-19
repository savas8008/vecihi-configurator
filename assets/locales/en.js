window.VECIHI_LOCALE_EN = {
  "header": {
    "connection_none": "No Connection",
    "disconnect": "Disconnect",
    "hw_gyro_title": "Gyroscope (MPU6050)",
    "hw_accel_title": "Accelerometer (MPU6050)",
    "hw_baro_title": "Barometer",
    "hw_pitot_title": "Pitot Tube (MS4525DO)",
    "hw_receiver_title": "RC Receiver"
  },

  "ticker": {
    "label": "Latest Updates"
  },

  "nav": {
    "sensors": "Sensors",
    "calibration": "Calibration",
    "mixer": "Mixer",
    "gps": "Navigation & GPS",
    "transmitter": "Radio",
    "modes": "Flight Modes",
    "pid": "PID",
    "advanced": "Preferences",
    "osd": "OSD",
    "waypoint": "Waypoint",
    "logs": "Logs",
    "home": "Configurator",
    "firmware": "Firmware",
    "ground_control": "Ground Control",
    "kml": "Log → KML",
    "docs": "Documents"
  },

  "connection": {
    "title": "Connect to Configurator",
    "description": "After powering on the device,",
    "description_bold": "within the first 10 seconds",
    "description_end": "connect to the serial port. Otherwise it enters flight mode.",
    "connect_btn": "Connect to Port"
  },

  "pin_common": {
    "reboot_warning": "When the save button is pressed, the device will",
    "reboot_warning_bold": "automatically restart",
    "reboot_warning_end": "and the connection will be re-established automatically.",
    "recommend": "Recommended: GPIO"
  },

  "firmware": {
    "title": "Firmware Update",
    "subtitle": "Flash Vecihi firmware onto ESP32",
    "current_version": "Current version:",
    "loading": "Loading...",
    "build_date": "Build:",
    "flash_warning": "Before flashing, disconnect the serial connection and refresh the browser tab.",
    "flash_btn": "Start Flash"
  },

  "kml": {
    "title": "EdgeTX Log → KML Converter",
    "subtitle": "Convert EdgeTX CSV log to Google Earth — no connection required.",
    "drop_text": "Drag & drop CSV file here or click to select",
    "drop_hint": "EdgeTX / OpenTX log format (.csv)",
    "stat_date": "Date",
    "stat_duration": "Duration",
    "stat_alt": "Max Altitude",
    "stat_speed": "Max Speed",
    "stat_dist": "Total Distance",
    "stat_gps": "GPS Points",
    "btn_download": "Download KML",
    "btn_earth": "Open in Google Earth",
    "btn_reset": "Reset",
    "ge_hint": "KML file downloaded. When Google Earth Web opens,",
    "ge_hint_bold": "File → Import",
    "ge_hint_end": "or drag & drop to load."
  },

  "docs": {
    "title": "Documents & Resources",
    "subtitle": "Wiring, setup and usage guides.",
    "wiring_label": "Wiring Guide",
    "wiring_caption": "Open wiring and connection diagram",
    "readme_label": "README / Setup",
    "readme_caption": "Open installation and usage steps",
    "video_label": "Demo Videos",
    "video_playlist": "Playlist",
    "video_caption": "Usage and walkthrough videos",
    "hw_label": "Hardware / PCB",
    "hw_caption": "Download PCB production files"
  },

  "sensors": {
    "title": "Live Sensor Data",
    "cal_view": "Calibration View",
    "flight_mode": "FLIGHT MODE",

    "gps_title": "GPS Status",
    "gps_sats": "SATELLITES",
    "gps_lat": "LATITUDE",
    "gps_lon": "LONGITUDE",
    "gps_speed": "GROUND SPEED (km/h)",
    "gps_airspeed": "AIR SPEED (km/h)",

    "alt_title": "Altitude & Compass",
    "altitude": "ALTITUDE",
    "vario": "VARIO",

    "battery_title": "Battery",
    "voltage": "VOLTAGE",
    "adc_pin": "ADC PIN",

    "map_title": "Position",
    "mcu_title": "MCU & System Status",
    "core1": "CORE 1 (LOOP)",
    "core0": "CORE 0 (SYS)",
    "temperature": "TEMPERATURE",
    "free_ram": "FREE RAM"
  },

  "calibration": {
    "page_title": "Calibration",
    "pin_title": "IMU Sensor Pins (I2C)",
    "pin_scl_label": "SCL",
    "pin_sda_label": "SDA",
    "pin_save": "Save I2C Pins",
    "gpio_scl_hint": "Recommended: GPIO 22",
    "gpio_sda_hint": "Recommended: GPIO 21",

    "pose_title": "Position Calibration (6-Axis)",
    "pose_hint": "Position the aircraft at each step and click",
    "pose_zp": "Level (wheels down)",
    "pose_zn": "Inverted (wheels up)",
    "pose_xp": "Nose up (vertical)",
    "pose_xn": "Nose down (vertical)",
    "pose_yp": "Left wing up",
    "pose_yn": "Right wing up",

    "current_values": "Current Calibration Values",

    "gyro_title": "Gyro Calibration",
    "gyro_hint": "Hold the device completely still and click.",

    "level_title": "Hard Calibration (Level)",
    "level_hint": "Place the device on a level surface, wait 2s, then click.",

    "btn_save": "Save Calibration",
    "btn_reset": "Reset Calibration",

    "align_title": "Sensor Orientation (Board Alignment)",
    "align_desc": "Select the mounting orientation of the flight controller inside the airframe. Calibration resets when changed.",
    "align_save": "Save Orientation"
  },

  "gps": {
    "page_title": "Navigation & GPS",
    "pin_title": "GPS Connection Pins (UART)",
    "pin_tx": "TX (ESP → GPS)",
    "pin_rx": "RX (GPS → ESP)",
    "pin_save": "Save GPS Pins",
    "gpio_tx_hint": "Recommended: GPIO 5",
    "gpio_rx_hint": "Recommended: GPIO 18",

    "hw_title": "GPS Hardware",
    "hw_active": "GPS Module Active",
    "hw_protocol": "Protocol",
    "hw_proto_auto": "Auto (Recommended)",
    "hw_proto_ubx6": "UBX Legacy (NEO-6M)",
    "hw_proto_ubx7": "UBX PVT (NEO-7+)",
    "hw_mag_align": "Mag Heading",
    "hw_min_sats": "Min Satellites",
    "hw_min_fix": "Min Fix Type",
    "hw_fix_2d": "2D Fix",
    "hw_fix_3d": "3D Fix",

    "rth_title": "RTH (Return to Home)",
    "rth_alt": "RTH Altitude (m)",
    "rth_radius": "Loiter Radius (m)",
    "loiter_dir": "Loiter Direction",
    "loiter_dir_right": "Right (CW)",
    "loiter_dir_left": "Left (CCW)",
    "loiter_shared_hint": "Radius and direction are shared between the RTH holding circle and the standalone LOITER mode.",
    "rth_geofence": "Geofence (m)",
    "rth_geofence_hint": "0=None",
    "rth_climb_first": "Climb First Before Returning Home",

    "angle_title": "Angle Limits",
    "angle_max_roll": "Max Roll (°)",
    "angle_max_climb": "Max Climb (°)",
    "angle_max_dive": "Max Dive (°)",

    "throttle_title": "Throttle Settings",
    "throttle_min": "Nav Min Throttle",
    "throttle_descend": "Descend Throttle",
    "throttle_cruise": "Cruise Throttle",
    "throttle_climb": "Climb Throttle",
    "throttle_max": "Nav Max Throttle",

    "l1_title": "L1 Navigation",
    "l1_desc": "Path tracking algorithm parameters.",
    "l1_period": "L1 Period (s)",
    "l1_period_hint": "Low=Aggressive, High=Smooth Turn",
    "l1_damping": "L1 Damping",
    "l1_pitch2thr": "Pitch → Throttle",
    "l1_pitch2thr_hint": "PWM throttle added per 1° pitch increase.",

    "turn_assist_enabled": "Use Turn Assist (Coordinated Turn)",
    "turn_assist_warning": "Disabled by default in every mode, including RTH. Test on the ground / at low altitude before enabling.",
    "turn_assist_ref_airspeed": "Reference Airspeed (m/s)",
    "turn_assist_ref_airspeed_hint": "Used when no pitot/virtual airspeed is available. Recommended: your aircraft's typical cruise speed, usually 12-20 m/s. Default: 15 m/s.",
    "turn_assist_yaw_gain": "Yaw Gain",
    "turn_assist_yaw_gain_hint": "Recommended starting point: 2.0 (the theoretical value of 1.0 can feel too weak in real flight). Adjust gradually from there. Range: 0.5-10.",

    "btn_save": "Save GPS & Nav"
  },

  "mixer": {
    "page_title": "Mixer",
    "pin_title": "Output Pins",
    "pin_recommend_btn": "Recommend",
    "pin_save": "Save Output Pins",
    "aux_hint1": "Auxiliary output 1",
    "aux_hint2": "Auxiliary output 2",

    "motor_ctrl": "MOTOR CTRL",
    "no_prop": "No propeller",
    "safety_warning": "⚠️ Approval required",

    "aux_title": "Auxiliary Outputs",
    "aux_desc": "Each auxiliary output passes the selected RC channel directly to the specified GPIO pin (outside the flight mixer). Use for camera gimbal, landing gear, lights or additional motor.",
    "rc_channel": "RC Channel",
    "ch_disabled": "Disabled",
    "ch_1_roll": "Channel 1 (Roll)",
    "ch_2_pitch": "Channel 2 (Pitch)",
    "ch_3_throttle": "Channel 3 (Throttle)",
    "ch_4_yaw": "Channel 4 (Yaw)",

    "aircraft_title": "Aircraft Type",
    "vtail_desc": "V-shaped tail structure",
    "ttail_desc": "T-shaped tail structure",
    "noruder_title": "NO RUDDER",
    "noruder_desc": "Without rudder",
    "delta_desc": "Delta wing",

    "gains_title": "Mixer Gains",
    "gains_desc": "Set the mixer ratio for each axis. 100 = normal, -100 = reversed, 50 = 50% power. If yaw is reversed, set Yaw to negative (e.g. -100).",
    "btn_save": "Save"
  },

  "transmitter": {
    "page_title": "Radio & Receiver Settings",
    "pin_title": "Receiver Connection Pins (UART)",
    "pin_tx": "TX (ESP → Receiver)",
    "pin_rx": "RX (Receiver → ESP)",
    "pin_save": "Save Receiver Pins",

    "config_title": "Configuration",
    "protocol_label": "COMMUNICATION PROTOCOL",
    "proto_sbus": "SBUS / IBUS",
    "proto_elrs": "CRSF (ELRS / Crossfire)",
    "proto_mavlink": "MAVLink",

    "ch_map_label": "CHANNEL MAP",
    "ch_map_hint": "Assign the desired physical receiver channel to each axis",
    "ch_reverse_label": "CHANNEL REVERSE",

    "live_title": "Live Channel Values",
    "waiting": "Waiting for data... Check connection.",

    "btn_save": "Save Radio Settings",

    "stick_cmds_link": "Stick Commands",
    "stick_modal_title": "RC Stick Commands",
    "stick_warn_important": "Important:",
    "stick_warn_text": "These commands only work when the aircraft is",
    "stick_warn_disarm": "DISARMED",
    "stick_warn_end": ". They are ignored when armed.",
    "stick_mode_warn_title": "Radio Type Notice:",
    "stick_mode_warn_text": "Diagrams are based on default",
    "stick_mode_warn_mode": "Mode 2",
    "stick_mode_warn_end": "layout. Positions may differ depending on your channel assignment. Before executing a command, verify",
    "stick_mode_warn_pwm": "PWM threshold values",
    "stick_mode_warn_verify": "in the live channel panel.",
    "force_arm_title": "Force Arm",
    "force_arm_desc": "Arms even if normal arm conditions are not met (insufficient satellites, etc.). Hold the following position for 2 seconds.",
    "left_stick": "Left Stick",
    "right_stick": "Right Stick",
    "arm_switch": "Arm Switch",
    "duration": "Duration",
    "save_settings_title": "Save Settings",
    "save_settings_desc": "If Autotune was performed in this session, writes PID values to persistent memory (NVS). If Autotune was not performed, the save is",
    "save_settings_skip": "skipped",
    "save_settings_end": "— no data corruption risk. Hold the following position for 2 seconds."
  },

  "modes": {
    "page_title": "Flight Modes",
    "btn_save": "Save Modes"
  },

  "pid": {
    "page_title": "PID Settings",
    "level_desc": "Self-leveling stiffness of the aircraft.",
    "tpa_desc": "Reduces PIFF gains proportionally as airspeed increases (requires throttle or pitot tube).",
    "btn_save": "Save PID"
  },

  "advanced": {
    "page_title": "Preferences",

    "bat_pin_title": "Battery Voltage Measurement (ADC)",
    "bat_pin_label": "ADC GPIO Pin",
    "bat_pin_save": "Save ADC Pins",
    "adc_pin_hint": "Recommended: GPIO 34, 35 or 36 (input-only)",

    "tab_flight": "Flight Limits",
    "tab_alt": "Altitude",
    "tab_hw": "Hardware & Filters",
    "tab_battery": "Battery",
    "tab_pitot": "Pitot Tube",

    "flight_section": "Flight Limits & Auto Launch",
    "angle_limits": "Angle Mode Limits",
    "angle_max_roll": "Max Roll Angle (°)",
    "angle_max_pitch": "Max Pitch Angle (°)",

    "launch_section": "Auto Launch",
    "launch_auto_on_arm": "Automatically enter launch mode after each arm",
    "launch_disarm_on_land": "Auto disarm after landing",
    "launch_acc_threshold": "Launch Threshold (G)",
    "launch_acc_hint": "Acceleration required to trigger launch",
    "launch_throttle": "Launch Throttle (PWM)",
    "launch_max_time": "Auto Launch max duration (seconds)",
    "launch_max_alt": "Auto Launch max altitude (meters)",
    "launch_angle": "Launch Angle (°)",
    "launch_spool_time": "Delay between throw and motor start (ms)",
    "launch_spool_hint": "Motor warm-up time before launch",
    "stick_cancel_thr": "Stick Cancel Threshold (PWM)",
    "stick_cancel_hint": "If stick deflection exceeds this value, Auto Launch or auto landing is cancelled (pilot takes over)",
    "thr_cancel_thr": "Throttle Cancel Threshold (PWM)",
    "thr_cancel_hint": "If throttle exceeds this value, auto landing is cancelled (pilot takes over)",

    "stall_section": "Stall Protection",
    "stall_speed": "Stall Speed (km/h)",
    "stall_speed_hint": "Stall protection activates below this speed",
    "stall_pitch_drop": "Pitch Drop (°)",
    "stall_pitch_hint": "How much to drop the nose during stall",

    "turn_assist_section": "Turn Assist (Coordinated Turn)",

    "flaperon_section": "Flaperon Droop",
    "flaperon_amount": "Droop Amount (µs)",
    "flaperon_info_title": "Flaperon Droop Setting:",
    "flaperon_info_1": "Symmetric droop applied to ailerons when flaperon is active. Range: −500–+500 µs.",
    "flaperon_info_2": "Positive value: ailerons deflect down (normal).",
    "flaperon_info_3": "Negative value: ailerons deflect up — use negative if ailerons move in reverse due to servo mounting (e.g. −150).",

    "alt_section": "Altitude Estimation",
    "alt_sensor_source": "Sensor Source",
    "alt_use_baro": "Use Barometer",
    "alt_kalman": "Kalman Filter Coefficients",
    "alt_baro_p": "Baro Position (P)",
    "alt_baro_v": "Baro Velocity (V)",
    "alt_acc_bias": "ACC Bias",
    "alt_acc_deadzone": "ACC Deadzone",
    "alt_acc_lpf": "ACC LPF",

    "hw_section": "Hardware, Sensor & Filters",
    "esc_section": "ESC Protocol",
    "esc_hz_label": "ESC Rate",
    "esc_hz_pwm": "PWM (50Hz - Analog)",
    "esc_hz_fast": "FastPWM (400Hz)",
    "servo_hz_label": "Servo Rate",
    "servo_hz_analog": "50Hz (Analog)",
    "servo_hz_digital": "160Hz (Digital)",
    "servo_hz_fast": "333Hz (Digital Fast)",
    "servo_hz_max": "400Hz (Maximum)",

    "gyro_section": "Gyro & IMU",
    "gyro_lpf_active": "Gyro LPF Active",
    "gyro_lpf_hz": "Gyro LPF (Hz)",
    "accel_lpf_hz": "Accel LPF (Hz)",
    "mahony_kp": "Mahony Kp",
    "mahony_ki": "Mahony Ki",

    "rpm_section": "RPM Filter",
    "rpm_active": "RPM Filter Active",
    "rpm_min_freq": "Min Frequency (Hz)",
    "rpm_max_freq": "Max Frequency (Hz)",
    "rpm_bw": "Bandwidth (%)",

    "trim_section": "Board Alignment (Trim)",
    "trim_roll": "Roll Trim (°)",
    "trim_pitch": "Pitch Trim (°)",

    "realtime_section": "Real-Time Sensor Data",
    "stream_start": "Start Data Stream",

    "bat_section": "Battery",
    "bat_voltage_section": "Voltage Measurement (ADC)",
    "bat_adc_hint": "ADC GPIO pin setting is at the top of the page.",
    "bat_scale": "Scale Factor",
    "bat_scale_hint": "(R1+R2)/R2",
    "bat_voltage_help_title": "Voltage Divider Calculation:",
    "bat_voltage_help": "ESP32 ADC input measures max 3.3V. A voltage divider is needed to reduce lipo voltage.",
    "bat_pin_disabled_hint": "If pin is -1, voltage measurement is disabled.",

    "bat_cell_section": "Cell Voltage Limits",
    "bat_cell_section_hint": "(OSD Battery Icon)",
    "bat_cell_min": "Empty Cell Voltage",
    "bat_cell_min_hint": "Per-cell empty voltage — battery icon appears empty below this threshold",
    "bat_cell_max": "Full Cell Voltage",
    "bat_cell_max_hint": "Per-cell full voltage — battery icon appears full at this threshold",
    "bat_cell_help_title": "OSD Battery Icon Calculation:",

    "bat_virtual_section": "Virtual Current Sensor",
    "bat_max_current": "Max Current (A)",
    "bat_max_current_hint": "Total current drawn by motor + all electronics at full throttle (A)",
    "bat_idle_current": "Idle Current (A)",
    "bat_idle_current_hint": "Idle current at zero throttle: receiver + servos + ESP32 (A)",
    "bat_calibration": "Calibration",
    "bat_calibration_hint": "Fine-tune after first flight: actual_consumption / estimated_consumption",
    "bat_capacity": "Capacity (mAh)",
    "bat_capacity_hint": "Total battery capacity — Bat% gauge on radio is calculated from this value",
    "bat_cal_steps_title": "Calibration Steps:",

    "bat_calc_section": "Calibration Calculators",
    "volt_calc_title": "Voltage Calibration",
    "volt_calc_shown": "Shown in telemetry (V)",
    "volt_calc_actual": "Actually measured (V)",
    "volt_calc_btn": "Calculate & Apply Scale",
    "volt_calc_hint": "Enter the actual voltage measured with a multimeter.",

    "mah_calc_title": "Capacity Calibration",
    "mah_calc_reported": "Estimated consumption (mAh)",
    "mah_calc_actual": "Actual consumption (mAh)",
    "mah_calc_btn": "Calculate & Apply Calibration",
    "mah_calc_hint": "Enter the mAh charged by the charger.",

    "pitot_section": "MS4525DO Pitot Tube",
    "pitot_sensor_label": "Pitot Sensor",
    "pitot_enabled": "Enabled",
    "pitot_disabled_hint": "When disabled, airspeed is calculated virtually (GPS-based).",
    "pitot_scale_label": "Scale",
    "pitot_scale_hint": "Default: 1.00 · Fine-tune for tube angle or length difference.",

    "btn_save": "Save Preferences"
  },

  "osd": {
    "page_title": "OSD Designer",
    "page_subtitle": "Customize display elements and system info",
    "pin_title": "OSD Connection Pins (UART)",
    "pin_tx": "TX (ESP → OSD)",
    "pin_rx": "RX (OSD → ESP)",
    "pin_save": "Save OSD Pins",
    "osd_active": "OSD Active",

    "font_warning_title": "Important:",
    "font_warning": "For OSD symbols to display correctly, your goggles must have the",
    "font_warning_bold": "INAV",
    "font_warning_end": "font selected. Otherwise meaningless symbols and characters will appear on screen.",

    "elements_title": "Display Elements",
    "el_arm_status": "Arm Status",
    "el_flight_mode": "Flight Mode",
    "el_speed": "Speed (Ground Speed)",
    "el_airspeed": "Air Speed (Airspeed)",
    "el_airspeed_hint": "Last character shows the source: P=Pitot (real sensor), V=Virtual (GPS estimate), ----=no data.",
    "el_rssi": "RSSI (Signal Strength)",
    "el_battery": "Battery Voltage",
    "el_altitude": "Altitude",
    "el_vario": "Vario (Vertical Speed)",
    "el_horizon": "Artificial Horizon",
    "el_home": "Home Info",
    "el_throttle": "Throttle",
    "el_wind": "Wind Info",
    "el_battery_cap": "Battery Capacity (mAh)",
    "el_cell_voltage": "Cell Voltage (V/cell)",
    "el_current": "Current (A)",
    "el_sys_msg": "System Messages",
    "el_sats": "Satellite Count",
    "el_lat": "GPS Latitude (Lat)",
    "el_lon": "GPS Longitude (Lon)",
    "el_gcode": "Google Plus Code",
    "el_timer": "Flight Timer",

    "preview_hint": "Preview Screen (50x20 Character Grid)",

    "settings_title": "System & Display Settings",
    "screen_ratio": "Screen Ratio",
    "pilot_name": "Pilot Name (Callsign)",
    "craft_name": "Aircraft Name",
    "units": "Units",
    "units_metric": "Metric (m, km/h)",
    "units_imperial": "Imperial (ft, mph)",
    "low_voltage": "Low Voltage (V)",
    "max_dist": "Distance Warning (m)",
    "btn_save": "Save Settings to Device"
  },

  "logs": {
    "page_title": "Command Console & System Logs",

    "shortcuts_title": "Shortcuts",
    "acc_system": "System & Configuration",
    "btn_factory": "FACTORY RESET",
    "btn_pid_reset": "RESET PID",
    "btn_calib_del": "DEL CALIB.",

    "acc_calibration": "Calibration Operations",
    "btn_gyro_reset": "RESET GYRO",
    "btn_level": "LEVEL (TRIM)",
    "btn_cal_start": "START",
    "btn_cal_solve": "SOLVE & SAVE",

    "acc_streams": "Live Data Streams",
    "stream_sensors": "SENSORS (GPS/BARO)",
    "stream_imu": "IMU (GYRO/ACCEL)",
    "stream_3d": "3D ATTITUDE (QUAT/EULER)",
    "stream_receiver": "RECEIVER & CHANNELS",
    "btn_open": "ON",
    "btn_close": "OFF",

    "acc_pages": "Refresh Page Data",
    "btn_advanced": "ADVANCED",
    "btn_outputs": "OUTPUTS",
    "btn_modes": "MODES",
    "btn_receiver": "RECEIVER",

    "acc_backup": "Settings Backup",
    "btn_export": "Export",
    "btn_import": "Import",

    "search_placeholder": "Search logs...",
    "filter_all": "All Records",
    "filter_info": "Info",
    "filter_success": "Success",
    "filter_warning": "Warnings",
    "filter_error": "Errors",
    "filter_command": "Outgoing Commands",
    "filter_receive": "Incoming Data",

    "auto_scroll": "Auto Scroll",
    "pause": "Pause Stream",
    "btn_clear": "Clear",
    "btn_save_log": "Save",

    "log_title": "System Logs",
    "cmd_label": "MANUAL COMMAND INPUT",
    "cmd_placeholder": "e.g. type CAL_GYRO and send...",

    "stats_title": "Communication Statistics",
    "stat_total": "Total Lines",
    "stat_commands": "Commands Sent",
    "stat_errors": "Error Count",
    "stat_success": "Success:",
    "stat_warning": "Warning:",
    "stat_error": "Error:"
  },

  "waypoint": {
    "page_title": "Waypoint Mission Planner",
    "map_title": "Map",
    "map_hint": "Click on the map to add waypoints",

    "upload_title": "Upload to FC",
    "btn_upload": "Save Waypoints",
    "btn_clear_all": "Clear All Waypoints",

    "list_title": "Waypoint List",
    "list_empty": "No waypoints added yet.",
    "list_empty_hint": "Click on the map.",
    "manual_add": "Add Manually",
    "btn_add": "Add",

    "kamikaze_title": "Kamikaze Mission Settings",
    "dive_section": "DIVE",
    "dive_angle": "Dive Angle (°)",
    "dive_angle_hint": "5° = shallow  —  90° = vertical",
    "dive_alt_offset": "Start Altitude Offset (m)",
    "dive_alt_hint": "0 = from WP altitude  —  negative = lower",

    "mission_section": "MISSION SYSTEM",
    "trigger_alt": "Trigger Altitude (m AGL)",
    "trigger_alt_hint": "Servo moves to full position at this altitude",
    "mission_servo": "Mission Servo",
    "mission_servo_disabled": "Disabled",

    "usage_section": "USAGE",
    "usage_1": "Configure dive angle and servo settings on the left",
    "usage_2": "Press the Save WP Parameters button",
    "usage_3": "Click the target point on the map",
    "usage_4": "Set the waypoint mission type to",
    "usage_4_bold": "Kamikaze",
    "usage_4_end": "",
    "usage_5": "Upload waypoints to FC",
    "usage_note": "Dive angle is fixed; start distance is automatically calculated based on current altitude.",

    "mission_params_title": "Mission General Parameters",
    "wp_capture_radius": "WP Capture Radius (m)",
    "wp_capture_hint": "Default: 25m",

    "land_assist_title": "Landing Assist Settings",
    "land_assist_subtitle": "Land Assist — Auto Circuit Based on Wind",

    "approach_section": "Approach",
    "approach_alt": "Approach Altitude (m AGL)",
    "circuit_dir": "Circuit Direction",
    "circuit_right": "Right Circuit",
    "circuit_left": "Left Circuit",

    "final_section": "Final Approach",
    "final_distance": "Final Start Distance (m)",
    "final_distance_hint": "0 = Auto (altitude÷tan3°)",
    "circuit_width": "Circuit Width (m)",

    "flare_section": "Flare & Throttle",
    "flare_alt": "Flare Start Altitude (m AGL)",
    "approach_throttle": "Approach Throttle (PWM)",
    "flare_throttle": "Flare Throttle (PWM)",

    "runway_section": "Runway",
    "min_wind_speed": "Min Wind Speed (m/s)",
    "manual_runway_hdg": "Manual Runway Heading (°)",

    "btn_save_wp": "Save WP Parameters"
  },

  "modal": {
    "confirm_title": "Confirm",
    "btn_cancel": "Cancel",
    "btn_confirm": "Proceed",
    "save_title": "Save Status",
    "btn_close": "Close",

    "pins_title": "Recommended Pins",
    "pins_subtitle": "The following assignments are recommended based on the shared diagram.",
    "pins_warning_title": "Important connection note",
    "pins_warning_text": "Use appropriate capacitors on the power rail between RF connections (GPS, receiver) and IMU components. Sudden current spikes and interference can corrupt IMU data, cause resets or measurement instability.",
    "pins_motor_section": "Motor and Servo Outputs",
    "pins_aux_section": "AUX Ports"
  },

  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "close": "Close",
    "reset": "Reset",
    "loading": "Loading...",
    "rev": "Rev",
    "on": "ON",
    "off": "OFF",
    "disabled": "Disabled",
    "recommended": "Recommended"
  }
};

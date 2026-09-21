-- Add map configuration columns to game_settings
alter table game_settings add column if not exists map_url text not null default '';
alter table game_settings add column if not exists map_width int not null default 1920;
alter table game_settings add column if not exists map_height int not null default 1080;

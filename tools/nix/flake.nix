# nix
{
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";

  outputs = { self, nixpkgs }:
  let
    systems = [
      "x86_64-linux"
      "aarch64-darwin"
      "x86_64-darwin"
    ];
    forAll = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});

    scriptsDir = ./scripts;
    files = builtins.readDir scriptsDir;
    names =
      builtins.map
        (n: builtins.replaceStrings [ ".sh" ] [ "" ] n)
        (builtins.filter
          (n: nixpkgs.lib.hasSuffix ".sh" n)
          (builtins.attrNames files));
  in
  {
    packages = forAll (pkgs:
      nixpkgs.lib.genAttrs names (name:
        pkgs.writeShellScriptBin name ''
          chmod +x "$PWD/tools/nix/scripts/${name}.sh"
          export PATH="$PWD/.devbox/nix/profile/default/bin:$PATH"
          exec "$PWD/tools/nix/scripts/${name}.sh" "$@"
        ''
      )
    );

    apps = forAll (pkgs:
      nixpkgs.lib.genAttrs names (name: {
        type = "app";
        program = "${self.packages.${pkgs.stdenv.system}.${name}}/bin/${name}";
      })
    );

    devShells = forAll (pkgs: {
      default = pkgs.mkShell {
        packages = (builtins.attrValues self.packages.${pkgs.stdenv.system}) ++ (with pkgs; []);
        shellHook = ''
          unset DEVELOPER_DIR
        '';
      };
    });
  };
}
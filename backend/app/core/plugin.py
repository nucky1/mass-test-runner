"""Interfaz TestPlugin, PluginFactory y DemoPlugin

Correcciones clave:
1) NO bloquear ejecución real por status="error" (puede venir de un test fallido sin config).
2) El test básico arma un config dummy a partir de config_schema (para evitar fallas por keys faltantes).
3) En test_plugin, solo se marca status="error" para errores de CARGA (syntax/imports/deps/clase faltante).
   Los errores de EJECUCIÓN quedan como error_message pero no bloquean el plugin.
"""

from abc import ABC, abstractmethod
from typing import Iterable, Dict, Any, Optional, Set, Tuple
import random
import importlib.util
import sys

from sqlalchemy.orm import Session

from app.models.dto import Case, Pred, Compare
from app.models.db import Plugin
from app.core.deps import validate_plugin_imports


class TestPlugin(ABC):
    """Interfaz que deben implementar todos los plugins"""

    @abstractmethod
    def obtener_casos(self, config: Dict[str, Any]) -> Iterable[Case]:
        """Obtiene los casos de prueba"""
        pass

    @abstractmethod
    def ejecutar_test(self, caso: Case, config: Dict[str, Any]) -> Pred:
        """Ejecuta el test para un caso y devuelve la predicción"""
        pass

    @abstractmethod
    def comparar_resultados(self, caso: Case, pred: Pred, config: Dict[str, Any]) -> Compare:
        """Compara el resultado esperado (truth) con la predicción"""
        pass


class DemoPlugin(TestPlugin):
    """Plugin de demostración para probar el pipeline end-to-end"""

    def obtener_casos(self, config: Dict[str, Any]) -> Iterable[Case]:
        """Genera casos simulados"""
        num_casos = config.get("num_casos", 30)
        error_rate = config.get("error_rate", 0.1)  # 10% de errores por defecto

        casos = []
        for i in range(num_casos):
            label_type = random.choice(["T1", "T4", "T2", "T3"])
            caso = Case(
                id=f"demo_case_{i+1}",
                data={
                    "label": label_type,
                    "input_text": f"Texto de prueba {i+1}",
                    "metadata": {"source": "demo", "index": i},
                },
            )
            casos.append(caso)

        return casos

    def ejecutar_test(self, caso: Case, config: Dict[str, Any]) -> Pred:
        """Ejecuta test simulado con algunos errores"""
        error_rate = config.get("error_rate", 0.1)

        if random.random() < error_rate:
            return Pred(
                ok=False,
                value=None,
                status="error",
                raw=None,
                meta={"error": "Simulated error", "case_id": caso.id},
            )

        truth_label = caso.data.get("label", "T1")
        labels = ["T1", "T2", "T3", "T4"]

        if random.random() < 0.7:
            pred_value = truth_label
        else:
            pred_value = random.choice([l for l in labels if l != truth_label])

        return Pred(
            ok=True,
            value=pred_value,
            status="success",
            raw=f'{{"prediction": "{pred_value}", "confidence": {random.uniform(0.5, 0.99):.2f}}}',
            meta={"confidence": random.uniform(0.5, 0.99), "model": "demo"},
        )

    def comparar_resultados(self, caso: Case, pred: Pred, config: Dict[str, Any]) -> Compare:
        """Compara truth vs pred"""
        truth = caso.data.get("label")

        if not pred.ok:
            return Compare(
                match=False,
                truth=truth,
                pred=None,
                reason="Error en ejecución: pred.ok = False",
                detail={"error": True, "pred_status": pred.status},
            )

        if pred.value is None:
            return Compare(
                match=False,
                truth=truth,
                pred=None,
                reason="Predicción vacía (pred.value es None)",
                detail={"empty_prediction": True},
            )

        match = truth == pred.value
        reason = "Match" if match else f"Truth: {truth}, Pred: {pred.value}"

        return Compare(
            match=match,
            truth=truth,
            pred=pred.value,
            reason=reason,
            detail={
                "match": match,
                "truth": truth,
                "pred": pred.value,
                "confidence": pred.meta.get("confidence", 0.0),
            },
        )


class PluginFactory:
    """Factory para obtener plugins por nombre"""

    _plugins: Dict[str, type] = {
        "demo": DemoPlugin,
    }
    _db_session: Optional[Session] = None

    @classmethod
    def set_db_session(cls, db: Session):
        """Establece la sesión de DB para cargar plugins dinámicos"""
        cls._db_session = db

    @classmethod
    def get(cls, name: str) -> TestPlugin:
        """Obtiene un plugin por nombre, validando su estado"""
        # Built-in
        if name in cls._plugins:
            return cls._plugins[name]()

        # DB
        if cls._db_session:
            plugin_db = (
                cls._db_session.query(Plugin)
                .filter(Plugin.plugin_name == name)
                .first()
            )

            if not plugin_db:
                raise ValueError(
                    f"Plugin '{name}' no encontrado. Plugins disponibles: {list(cls._plugins.keys())}"
                )

            # ✅ NO bloquear por status="error" (puede venir de test sin config).
            # ✅ Mantener bloqueo por disabled.
            if plugin_db.status == "disabled":
                raise ValueError(f"Plugin '{name}' está deshabilitado")

            # Cargar plugin dinámicamente (si falla acá sí es un error real de carga)
            try:
                return cls._load_plugin_from_code(plugin_db.code, name)
            except Exception as e:
                plugin_db.status = "error"
                plugin_db.error_message = str(e)
                cls._db_session.commit()
                raise ValueError(f"Error al cargar plugin '{name}': {str(e)}")

        raise ValueError(
            f"Plugin '{name}' no encontrado. Plugins disponibles: {list(cls._plugins.keys())}"
        )

    @classmethod
    def _load_plugin_from_code(cls, code: str, plugin_name: str) -> TestPlugin:
        """Carga un plugin desde código Python dinámicamente"""
        # Validar imports antes de ejecutar
        is_valid, error_msg = validate_plugin_imports(code)
        if not is_valid:
            raise ValueError(error_msg)

        module_name = f"plugin_{plugin_name.replace('-', '_')}"

        try:
            spec = importlib.util.spec_from_loader(module_name, loader=None)
            module = importlib.util.module_from_spec(spec)

            # registrar módulo (debug/imports)
            sys.modules[module_name] = module

            # inyectar símbolos base para que el plugin no deba importarlos
            module.__dict__.update(
                {
                    "TestPlugin": TestPlugin,
                    "Case": Case,
                    "Pred": Pred,
                    "Compare": Compare,
                }
            )

            exec(code, module.__dict__)

            # Buscar la clase que implementa TestPlugin
            plugin_class = None
            for attr_name in dir(module):
                attr = getattr(module, attr_name)
                if (
                    isinstance(attr, type)
                    and issubclass(attr, TestPlugin)
                    and attr is not TestPlugin
                ):
                    plugin_class = attr
                    break

            if not plugin_class:
                for class_name in [
                    plugin_name.title().replace("-", ""),
                    f"{plugin_name}Plugin".replace("-", ""),
                    "PluginClass",
                    "CustomPlugin",
                ]:
                    if hasattr(module, class_name):
                        attr = getattr(module, class_name)
                        if isinstance(attr, type) and issubclass(attr, TestPlugin):
                            plugin_class = attr
                            break

            if not plugin_class:
                raise ValueError(
                    "No se encontró una clase que implemente TestPlugin en el código del plugin. "
                    "El código debe definir una clase que herede de TestPlugin."
                )

            return plugin_class()

        except Exception as e:
            raise ValueError(f"Error al compilar/cargar código del plugin: {str(e)}")

    @classmethod
    def register(cls, name: str, plugin_class: type):
        """Registra un nuevo plugin (para extensibilidad futura)"""
        cls._plugins[name] = plugin_class

    @staticmethod
    def _build_dummy_config_from_schema(schema: dict) -> dict:
        """Genera un config dummy a partir del config_schema (evita fallos por keys faltantes)."""
        dummy: Dict[str, Any] = {}
        for k, t in (schema or {}).items():
            if t == "int":
                dummy[k] = 0
            elif t == "float":
                dummy[k] = 0.0
            elif t == "bool":
                dummy[k] = False
            else:
                dummy[k] = ""
        return dummy

    @staticmethod
    def _is_load_error(msg: str) -> bool:
        """Heurística: errores de carga vs errores de ejecución."""
        m = (msg or "").lower()
        return (
            "error de sintaxis" in m
            or "dependency not allowed" in m
            or "missing dependency" in m
            or "error al compilar/cargar" in m
            or "no se encontró una clase que implemente testplugin" in m
        )

    @classmethod
    def test_plugin(cls, plugin_name: str, db: Session) -> Tuple[bool, Optional[str]]:
        """Prueba un plugin para verificar que funciona correctamente.

        Importante:
        - Arma un config dummy desde config_schema para evitar fallos por ausencia de keys.
        - No marca status=error por errores de ejecución; solo por errores de carga.
        """
        original_session = cls._db_session
        try:
            cls.set_db_session(db)

            plugin_db = db.query(Plugin).filter(Plugin.plugin_name == plugin_name).first()
            schema = plugin_db.config_schema if plugin_db else {}
            test_config = cls._build_dummy_config_from_schema(schema)

            plugin = cls.get(plugin_name)

            # Hacer una prueba básica
            casos = list(plugin.obtener_casos(test_config))
            if not casos:
                raise ValueError("Plugin no genera casos de prueba")

            # Probar ejecutar un caso
            caso = casos[0]
            pred = plugin.ejecutar_test(caso, test_config)
            if not isinstance(pred, Pred):
                raise ValueError("ejecutar_test no retorna un objeto Pred válido")

            # Probar comparar
            cmp = plugin.comparar_resultados(caso, pred, test_config)
            if not isinstance(cmp, Compare):
                raise ValueError("comparar_resultados no retorna un objeto Compare válido")

            # Si llegamos aquí, el plugin funciona
            if plugin_db:
                from datetime import datetime

                plugin_db.status = "active"
                plugin_db.error_message = None
                plugin_db.last_test_at = datetime.utcnow()
                db.commit()

            return True, None

        except Exception as e:
            msg = str(e)

            plugin_db = db.query(Plugin).filter(Plugin.plugin_name == plugin_name).first()
            if plugin_db:
                from datetime import datetime

                # Guardamos siempre el mensaje (para que se vea en la UI)
                plugin_db.error_message = msg
                plugin_db.last_test_at = datetime.utcnow()

                # ✅ Solo marcamos status="error" si es un error de CARGA
                if cls._is_load_error(msg):
                    plugin_db.status = "error"

                db.commit()

            return False, msg

        finally:
            cls._db_session = original_session

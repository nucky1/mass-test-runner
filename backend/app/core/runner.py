"""MassTestRunner: ejecuta tests masivos usando un plugin"""
from app.core.plugin import PluginFactory, TestPlugin
from app.core.store import ResultStore
from app.models.dto import RunResult, Metrics, RunConfig
from sqlalchemy.orm import Session


class MassTestRunner:
    """Runner principal que ejecuta tests masivos"""
    
    def __init__(self, store: ResultStore):
        self.store = store
    
    def run(self, config: RunConfig, db: Session) -> RunResult:
        """Ejecuta un test run completo (crea el run)"""
        # Crear run
        run_id = self.store.create_run(config.plugin_name, config.config)
        return self.run_existing(run_id, config, db)
    
    def run_existing(self, run_id: str, config: RunConfig, db: Session) -> RunResult:
        """Ejecuta un test run para un run_id existente"""
        # Configurar DB session en PluginFactory para cargar plugins dinámicos
        PluginFactory.set_db_session(db)
        
        # Obtener plugin (valida estado automáticamente)
        plugin = PluginFactory.get(config.plugin_name)
        
        try:
            # Obtener casos
            casos = plugin.obtener_casos(config.config)
            
            # Convertir a lista si es iterable (para contar total)
            casos_list = list(casos) if not isinstance(casos, list) else casos
            total_cases = len(casos_list)
            
            # Actualizar total de casos
            self.store.update_run_progress(run_id, total_cases=total_cases)
            
            # Procesar cada caso
            for caso in casos_list:
                # Ejecutar test
                pred = plugin.ejecutar_test(caso, config.config)
                
                # Comparar resultados
                cmp = plugin.comparar_resultados(caso, pred, config.config)
                
                # Guardar detalle (actualiza progreso automáticamente)
                self.store.save_detail(run_id, caso, pred, cmp)
            
            # Calcular métricas y cerrar run
            metrics = self.store.compute_metrics(run_id)
            self.store.close_run(run_id)
            
            return RunResult(run_id=run_id, metrics=metrics)
        
        except Exception as e:
            # Marcar run como failed
            run = self.store.get_run(run_id)
            if run:
                run.status = "failed"
                self.store.db.commit()
            raise e
